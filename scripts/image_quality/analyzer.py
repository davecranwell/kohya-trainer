#!/usr/bin/env python3
"""
analyzer.py - Core image quality analysis functionality
"""

import os
import numpy as np
from PIL import Image
import scipy.fft
from scipy.signal import convolve2d
from dataclasses import dataclass
from typing import Dict, List, Tuple
from scipy.ndimage import uniform_filter
from collections import Counter
import logging
import cv2
from skimage.filters.rank import entropy
from skimage.morphology import disk

@dataclass
class ImageQualityMetrics:
    filename: str
    width: int
    height: int
    face_coverage: float
    blur_score: float
    detail_score: float
    edge_density: float
    local_variance: float
    saturation_mean: float
    contrast_score: float
    is_acceptable: bool
    rejection_reasons: List[str]

class ImageQualityAnalyzer:
    """Comprehensive image quality analysis including blur detection and detail assessment"""
    
    def __init__(
        self,
        min_width: int = 800,
        min_height: int = 600,
        min_face_coverage: float = 0.5,
        min_saturation: float = 0.2,
        max_saturation: float = 0.8,
        min_contrast: float = 0.3,
        blur_threshold: float = 50.0,
        detail_threshold: float = 0.5,
        face_roi_size: Tuple[int, int] = (224, 224)
    ):
        self.min_width = min_width
        self.min_height = min_height
        self.min_face_coverage = min_face_coverage
        self.min_saturation = min_saturation
        self.max_saturation = max_saturation
        self.min_contrast = min_contrast
        self.blur_threshold = blur_threshold
        self.detail_threshold = detail_threshold
        self.face_roi_size = face_roi_size
        self.analyzed_images: List[ImageQualityMetrics] = []

    def analyze_image(self, image_path: str) -> ImageQualityMetrics:
        """Analyze a single image for all quality metrics"""
        try:
            with Image.open(image_path) as image:
                # Convert to RGB if needed
                if image.mode != 'RGB':
                    image = image.convert('RGB')
                
                rejection_reasons = []
                
                # Basic dimension checks
                width, height = image.size
                if width < self.min_width or height < self.min_height:
                    rejection_reasons.append(f"Resolution too low: {width}x{height}")

                # Convert to numpy array for analysis
                np_image = np.array(image)
                gray_image = np.array(image.convert('L'), dtype=float)

                # Analyze blur
                is_blurry, blur_score = self._detect_blur(gray_image)
                if is_blurry:
                    rejection_reasons.append(f"Image too blurry (score: {blur_score:.2f})")

                # Analyze detail with weighted combination
                detail_metrics = self._analyze_detail(image)
                
                # Calculate weighted detail score with emphasis on edge density
                detail_score = (
                    detail_metrics['frequency_score'] * 0.3 +   # Frequency components
                    detail_metrics['edge_density'] * 0.5 +      # Edge information (primary)
                    detail_metrics['local_variance'] * 0.2      # Local contrast
                )
                
                if detail_score < 50:
                    rejection_reasons.append(f"Insufficient detail: {detail_score:.1f}/100")
                    if detail_metrics['edge_density'] < 40:
                        rejection_reasons.append(f"Low edge detail: {detail_metrics['edge_density']:.1f}/100")
                    if detail_metrics['frequency_score'] < 40:
                        rejection_reasons.append(f"Low frequency detail: {detail_metrics['frequency_score']:.1f}/100")

                # Color analysis
                saturation_score = self._analyze_saturation(np_image)
                contrast_score = self._analyze_contrast(gray_image)
                
                if saturation_score < 50:
                    rejection_reasons.append(f"Poor saturation: {saturation_score:.1f}/100")
                
                if contrast_score < 50:
                    rejection_reasons.append(f"Insufficient contrast: {contrast_score:.1f}/100")

                metrics = ImageQualityMetrics(
                    filename=os.path.basename(image_path),
                    width=width,
                    height=height,
                    face_coverage=0.0,
                    blur_score=blur_score,  # Now 0-100
                    detail_score=detail_score,  # Now 0-100
                    edge_density=detail_metrics['edge_density'],  # Now 0-100
                    local_variance=detail_metrics['local_variance'],  # Now 0-100
                    saturation_mean=saturation_score,  # Now 0-100
                    contrast_score=contrast_score,  # Now 0-100
                    is_acceptable=len(rejection_reasons) == 0,
                    rejection_reasons=rejection_reasons
                )
                
                self.analyzed_images.append(metrics)
                return metrics

        except Exception as e:
            logging.error(f"Error analyzing {image_path}: {str(e)}")
            raise

    def _detect_blur(self, image: np.ndarray) -> Tuple[bool, float]:
        """Detect if an image is blurry using Laplacian variance, focusing on high-detail regions."""
        # First find regions of high detail using local entropy
        window_size = 9  # Size of the window for entropy calculation
        height, width = image.shape
        
        # Calculate local entropy
        img_uint8 = (image / image.max() * 255).astype(np.uint8)
        entropy_map = entropy(img_uint8, disk(window_size))
        
        # Find regions of high entropy (likely to be in focus / subject areas)
        threshold = np.percentile(entropy_map, 90)  # Top 10% of entropy values
        high_detail_mask = entropy_map > threshold
        
        # If no high detail regions found, fall back to full image
        if not np.any(high_detail_mask):
            high_detail_mask = np.ones_like(image, dtype=bool)
        
        # Apply Laplacian operator
        laplacian = np.array([[0, 1, 0], [1, -4, 1], [0, 1, 0]])
        conv_result = np.abs(self._convolve2d(image, laplacian))
        
        # Calculate blur score only in high detail regions
        blur_score = np.var(conv_result[high_detail_mask[:-2, :-2]])  # Adjust for convolution size
        
        # Normalize blur score: 0 is blurry, 100 is sharp
        # Using blur_threshold as reference point (should give 50)
        normalized_score = min(100, (blur_score / self.blur_threshold) * 50)
        
        # For visualization (if needed)
        self._last_entropy_map = entropy_map
        self._last_high_detail_mask = high_detail_mask
        
        return normalized_score < 50, normalized_score

    def _analyze_detail(self, image: Image.Image) -> Dict[str, float]:
        """Analyze detail level in the image. All scores normalized to 0-100."""
        gray_img = np.array(image.convert('L'), dtype=float)
        
        # Get raw scores
        freq_score = self._analyze_frequency_distribution(gray_img)
        edge_score = self._calculate_edge_density(gray_img)
        var_score = self._calculate_local_variance(gray_img)
        
        # More nuanced normalization for each component
        # Frequency score - use sigmoid for smoother transition
        freq_norm = 100 / (1 + np.exp(-10 * (freq_score - self.detail_threshold)))
        
        # Edge density - normalize based on typical range (0-15)
        # Use percentile-based normalization
        edge_norm = np.clip(edge_score * 6.67, 0, 100)  # 15 * 6.67 = 100
        
        # Local variance - use log scale for better distribution
        # Typical values range from 50-5000
        var_norm = np.clip(20 * np.log10(1 + var_score), 0, 100)
        
        # Weight the components based on their reliability
        detail_scores = {
            'frequency_score': freq_norm,
            'edge_density': edge_norm,
            'local_variance': var_norm
        }
        
        return detail_scores

    def _analyze_frequency_distribution(self, img_array: np.ndarray) -> float:
        """Analyze frequency distribution using FFT"""
        fft = scipy.fft.fft2(img_array)
        fft_shift = scipy.fft.fftshift(fft)
        magnitude_spectrum = np.abs(fft_shift)
        
        rows, cols = img_array.shape
        center_row, center_col = rows // 2, cols // 2
        y, x = np.ogrid[-center_row:rows-center_row, -center_col:cols-center_col]
        radius = np.sqrt(x*x + y*y)
        
        high_freq_mask = radius > (rows * self.detail_threshold)
        high_freq_energy = np.sum(magnitude_spectrum * high_freq_mask)
        total_energy = np.sum(magnitude_spectrum)
        
        return high_freq_energy / total_energy if total_energy > 0 else 0

    def _calculate_edge_density(self, img_array: np.ndarray) -> float:
        """Calculate edge density using Sobel operators"""
        sobel_x = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]])
        sobel_y = np.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]])
        
        grad_x = np.abs(self._convolve2d(img_array, sobel_x))
        grad_y = np.abs(self._convolve2d(img_array, sobel_y))
        
        gradient_magnitude = np.sqrt(grad_x**2 + grad_y**2)
        return float(np.mean(gradient_magnitude))

    def _calculate_local_variance(self, img_array: np.ndarray, window_size: int = 3) -> float:
        """Calculate average local variance in small windows"""
        local_mean = uniform_filter(img_array, size=window_size)
        local_sqr_mean = uniform_filter(img_array**2, size=window_size)
        local_var = local_sqr_mean - local_mean**2
        
        return float(np.mean(local_var))

    def _analyze_saturation(self, image: np.ndarray) -> float:
        """Analyze image saturation. Returns normalized 0-100 score."""
        r, g, b = image[:,:,0], image[:,:,1], image[:,:,2]
        max_rgb = np.maximum(np.maximum(r, g), b)
        min_rgb = np.minimum(np.minimum(r, g), b)
        diff = max_rgb - min_rgb
        saturation = np.zeros_like(max_rgb, dtype=np.float32)
        non_zero = max_rgb != 0
        saturation[non_zero] = diff[non_zero] / max_rgb[non_zero]
        mean_saturation = float(np.mean(saturation))
        
        # Convert to 0-100 score
        # Score peaks at ideal saturation (halfway between min and max thresholds)
        ideal_saturation = (self.min_saturation + self.max_saturation) / 2
        if mean_saturation < ideal_saturation:
            # Scale 0 -> min_saturation to 0 -> 100
            normalized_score = (mean_saturation / self.min_saturation) * 100
        else:
            # Scale max_saturation -> ideal_saturation to 0 -> 100
            normalized_score = (1 - (mean_saturation - ideal_saturation) / 
                              (self.max_saturation - ideal_saturation)) * 100
            
        return max(0, min(100, normalized_score))

    def _analyze_contrast(self, gray_image: np.ndarray) -> float:
        """Analyze image contrast. Returns normalized 0-100 score."""
        if np.mean(gray_image) == 0:
            return 0
            
        contrast = float(np.std(gray_image) / np.mean(gray_image))
        
        # Normalize to 0-100 scale
        # Using min_contrast as reference point (should give 50)
        normalized_score = min(100, (contrast / self.min_contrast) * 50)
        return normalized_score

    def _convolve2d(self, img: np.ndarray, kernel: np.ndarray) -> np.ndarray:
        """Helper function for 2D convolution"""
        return np.abs(
            convolve2d(img, kernel, mode='valid')
        )

    def get_dataset_summary(self) -> Dict:
        """Analyze the entire dataset for trends and issues"""
        if not self.analyzed_images:
            return {"error": "No images analyzed"}

        return {
            "total_images": len(self.analyzed_images),
            "accepted_images": sum(1 for m in self.analyzed_images if m.is_acceptable),
            "rejection_reasons": dict(Counter(
                reason
                for metrics in self.analyzed_images
                for reason in metrics.rejection_reasons
            )),
            "average_metrics": {
                "blur_score": np.mean([m.blur_score for m in self.analyzed_images]),
                "detail_score": np.mean([m.detail_score for m in self.analyzed_images]),
                "saturation": np.mean([m.saturation_mean for m in self.analyzed_images]),
                "contrast": np.mean([m.contrast_score for m in self.analyzed_images])
            }
        }

    def visualize_analysis(self, img: np.ndarray, metrics: ImageQualityMetrics) -> np.ndarray:
        """Draw quality analysis results on the image."""
        # Make a copy to avoid modifying the original
        viz_img = img.copy()
        
        # If we have entropy information, show the high-detail regions
        if hasattr(self, '_last_high_detail_mask') and self._last_high_detail_mask is not None:
            # Resize mask to match image size if needed
            mask = cv2.resize(self._last_high_detail_mask.astype(np.uint8), 
                            (img.shape[1], img.shape[0]))
            
            # Create semi-transparent overlay
            overlay = np.zeros_like(viz_img)
            overlay[mask > 0] = [0, 255, 0]  # Green for high-detail regions
            cv2.addWeighted(overlay, 0.3, viz_img, 1.0, 0, viz_img)
        
        # Define colors and font settings
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.6
        thickness = 2
        padding = 5
        line_height = 25
        
        # Create background for text
        header = f"Quality Analysis: {'PASS' if metrics.is_acceptable else 'FAIL'}"
        text_lines = [
            header,
            f"Blur: {metrics.blur_score:.2f}",
            f"Detail: {metrics.detail_score:.2f}",
            f"Saturation: {metrics.saturation_mean:.2f}",
            f"Contrast: {metrics.contrast_score:.2f}"
        ]
        
        # Add rejection reasons if any
        if metrics.rejection_reasons:
            text_lines.append("Rejection Reasons:")
            for reason in metrics.rejection_reasons:
                text_lines.append(f"- {reason}")
        
        # Calculate text block size
        max_width = 0
        for line in text_lines:
            (width, height), _ = cv2.getTextSize(line, font, font_scale, thickness)
            max_width = max(max_width, width)
        
        # Draw semi-transparent background
        overlay = viz_img.copy()
        bg_height = len(text_lines) * line_height + padding * 2
        cv2.rectangle(
            overlay,
            (0, 0),
            (max_width + padding * 2, bg_height),
            (0, 0, 0),
            -1
        )
        cv2.addWeighted(overlay, 0.7, viz_img, 0.3, 0, viz_img)
        
        # Draw text
        y = line_height
        for i, line in enumerate(text_lines):
            color = (0, 255, 0) if i == 0 and metrics.is_acceptable else (0, 0, 255) if i == 0 else (255, 255, 255)
            cv2.putText(
                viz_img,
                line,
                (padding, y),
                font,
                font_scale,
                color,
                thickness
            )
            y += line_height
        
        return viz_img 