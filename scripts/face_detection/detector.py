"""
detector.py - Core face detection and cropping functionality
"""

import cv2
import numpy as np
from dataclasses import dataclass
from typing import List, Tuple, Optional, Dict
import logging
import threading

@dataclass
class FaceDetection:
    x: int
    y: int
    width: int
    height: int
    confidence: float = 0.0
    
    def get_box(self) -> Tuple[int, int, int, int]:
        return (self.x, self.y, self.width, self.height)
    
    def calculate_iou(self, other: 'FaceDetection') -> float:
        """Calculate Intersection over Union with another detection."""
        x_left = max(self.x, other.x)
        y_top = max(self.y, other.y)
        x_right = min(self.x + self.width, other.x + other.width)
        y_bottom = min(self.y + self.height, other.y + other.height)
        
        if x_right < x_left or y_bottom < y_top:
            return 0.0
            
        intersection = (x_right - x_left) * (y_bottom - y_top)
        area1 = self.width * self.height
        area2 = other.width * other.height
        union = area1 + area2 - intersection
        
        return intersection / union

class FaceCropper:
    """Face detection and cropping functionality"""
    def __init__(self, padding_percent: float = 50):
        self.padding_percent = padding_percent
        # Store cascade paths instead of initializing classifiers
        self.cascade_paths = {
            'front': cv2.data.haarcascades + 'haarcascade_frontalface_default.xml',
            'front_alt': cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml',  # Better alternative
            'profile_left': cv2.data.haarcascades + 'haarcascade_profileface.xml'
        }
        # Thread-local storage for cascade classifiers
        self._local = threading.local()

    @property
    def cascades(self) -> Dict[str, cv2.CascadeClassifier]:
        """Get thread-local cascade classifiers."""
        if not hasattr(self._local, 'cascades'):
            # Initialize cascades for this thread
            self._local.cascades = {
                name: cv2.CascadeClassifier(path)
                for name, path in self.cascade_paths.items()
            }
        return self._local.cascades

    def detect_faces(self, gray_img: np.ndarray) -> List[FaceDetection]:
        """Detect faces using multiple cascades and multiple rotations."""
        all_faces = []
        
        try:
            # Store original dimensions for scaling back
            orig_height, orig_width = gray_img.shape
            orig_img = gray_img.copy()
            
            # First scale the image to a standard size for detection
            target_size = 1024
            scale = min(target_size / orig_width, target_size / orig_height)
            
            if scale < 1.0:  # Only scale down, never up
                new_width = int(orig_width * scale)
                new_height = int(orig_height * scale)
                gray_img = cv2.resize(gray_img, (new_width, new_height))
            else:
                scale = 1.0
                new_width, new_height = orig_width, orig_height
            
            # Normalize image for better detection
            gray_img = cv2.equalizeHist(gray_img.astype(np.uint8))
            
            # Base parameters for detection at standard size
            front_params = {
                'scaleFactor': 1.3,
                'minNeighbors': 4,
                'minSize': (100, 100),
                'flags': cv2.CASCADE_SCALE_IMAGE
            }
            
            # More lenient parameters for profile detection
            profile_params = {
                'scaleFactor': 1.3,  # More gradual scaling for profiles
                'minNeighbors': 3,   # More lenient neighbor requirement
                'minSize': (100, 100),
                'flags': cv2.CASCADE_SCALE_IMAGE
            }
            
            # Define rotation angles - different sets for front and profile
            angles = [0, 10, -10, -15, 15, -20, 20, -30, 30, 40,-40, 45, -45, 50, -50, 55, -55, 60, -60, 90, -90, ]  # Less extreme for frontal
            
            center = (new_width // 2, new_height // 2)
            
            # First try frontal detection
            for angle in angles:
                try:
                    if angle != 0:
                        M = cv2.getRotationMatrix2D(center, angle, 1.0)
                        rotated = cv2.warpAffine(gray_img, M, (new_width, new_height))
                    else:
                        rotated = gray_img
                    
                    # Try frontal cascades
                    for name, cascade in self.cascades.items():
                        if 'profile' not in name:  # Only use frontal cascades here
                            try:
                                detections = cascade.detectMultiScale(rotated, **front_params)
                                
                                for (x, y, w, h) in detections:
                                    # If image was rotated, transform detection coordinates back
                                    if angle != 0:
                                        # Get corners of detection
                                        corners = np.array([
                                            [x, y],
                                            [x + w, y],
                                            [x + w, y + h],
                                            [x, y + h]
                                        ], dtype=np.float32)
                                        
                                        # Rotate corners back
                                        M_inv = cv2.getRotationMatrix2D(center, -angle, 1.0)
                                        for i in range(len(corners)):
                                            px = corners[i][0]
                                            py = corners[i][1]
                                            corners[i][0] = M_inv[0][0] * px + M_inv[0][1] * py + M_inv[0][2]
                                            corners[i][1] = M_inv[1][0] * px + M_inv[1][1] * py + M_inv[1][2]
                                        
                                        # Get bounding box of rotated corners
                                        x = int(np.min(corners[:, 0]))
                                        y = int(np.min(corners[:, 1]))
                                        w = int(np.max(corners[:, 0]) - x)
                                        h = int(np.max(corners[:, 1]) - y)
                                    
                                    # Scale back to original image coordinates
                                    orig_x = int(x / scale)
                                    orig_y = int(y / scale)
                                    orig_w = int(w / scale)
                                    orig_h = int(h / scale)
                                    
                                    # Calculate confidence based on detection size and angle
                                    face_area = orig_w * orig_h
                                    image_area = orig_width * orig_height
                                    size_ratio = face_area / image_area
                                    angle_penalty = abs(angle) / 90.0 * 0.2  # Max 0.2 penalty for angle
                                    confidence = 0.8 + min(size_ratio * 5, 0.2) - angle_penalty
                                    
                                    all_faces.append(FaceDetection(orig_x, orig_y, orig_w, orig_h, confidence))
                                    
                            except cv2.error as e:
                                logging.warning(f"OpenCV error during detection: {str(e)}")
                                continue
                            
                except Exception as e:
                    logging.warning(f"Error processing angle {angle}: {str(e)}")
                    continue
            
            # Then try profile detection
            # Create a mirrored version for right profiles
            flipped = cv2.flip(gray_img, 1)
            
            for angle in angles:
                for img in [gray_img, flipped]:  # Try both original and flipped
                    try:
                        if angle != 0:
                            M = cv2.getRotationMatrix2D(center, angle, 1.0)
                            rotated = cv2.warpAffine(img, M, (new_width, new_height))
                        else:
                            rotated = img
                        
                        # Only use profile cascade
                        cascade = self.cascades['profile_left']
                        try:
                            detections = cascade.detectMultiScale(rotated, **profile_params)
                            
                            for (x, y, w, h) in detections:
                                # If image was rotated, transform detection coordinates back
                                if angle != 0:
                                    # Get corners of detection
                                    corners = np.array([
                                        [x, y],
                                        [x + w, y],
                                        [x + w, y + h],
                                        [x, y + h]
                                    ], dtype=np.float32)
                                    
                                    # Rotate corners back
                                    M_inv = cv2.getRotationMatrix2D(center, -angle, 1.0)
                                    for i in range(len(corners)):
                                        px = corners[i][0]
                                        py = corners[i][1]
                                        corners[i][0] = M_inv[0][0] * px + M_inv[0][1] * py + M_inv[0][2]
                                        corners[i][1] = M_inv[1][0] * px + M_inv[1][1] * py + M_inv[1][2]
                                    
                                    # Get bounding box of rotated corners
                                    x = int(np.min(corners[:, 0]))
                                    y = int(np.min(corners[:, 1]))
                                    w = int(np.max(corners[:, 0]) - x)
                                    h = int(np.max(corners[:, 1]) - y)
                                
                                # Scale back to original image coordinates
                                orig_x = int(x / scale)
                                orig_y = int(y / scale)
                                orig_w = int(w / scale)
                                orig_h = int(h / scale)
                                
                                # Calculate confidence based on detection size and angle
                                face_area = orig_w * orig_h
                                image_area = orig_width * orig_height
                                size_ratio = face_area / image_area
                                angle_penalty = abs(angle) / 90.0 * 0.2  # Max 0.2 penalty for angle
                                
                                # Adjust confidence for profile detections
                                confidence = 0.7 + min(size_ratio * 5, 0.2) - angle_penalty  # Lower base confidence for profiles
                                
                                # If this was detected in the flipped image, adjust coordinates
                                if img is flipped:
                                    orig_x = orig_width - (orig_x + orig_w)
                                
                                all_faces.append(FaceDetection(orig_x, orig_y, orig_w, orig_h, confidence))
                                
                        except cv2.error as e:
                            logging.warning(f"OpenCV error during profile detection: {str(e)}")
                            continue
                            
                    except Exception as e:
                        logging.warning(f"Error processing profile angle {angle}: {str(e)}")
                        continue
            
            return self._remove_duplicates(all_faces)
            
        except Exception as e:
            logging.error(f"Error in face detection: {str(e)}")
            return all_faces
    
    def _remove_duplicates(self, faces: List[FaceDetection], iou_threshold: float = 0.5) -> List[FaceDetection]:
        """Remove overlapping detections using IoU and containment, keeping highest confidence ones."""
        # Sort faces by confidence (highest first)
        faces = sorted(faces, key=lambda x: x.confidence, reverse=True)
        unique_faces = []
        
        for face in faces:
            is_duplicate = False
            for unique_face in unique_faces:
                # Check if one detection is fully contained within another
                contained = (
                    face.x >= unique_face.x and
                    face.y >= unique_face.y and
                    (face.x + face.width) <= (unique_face.x + unique_face.width) and
                    (face.y + face.height) <= (unique_face.y + unique_face.height)
                ) or (
                    unique_face.x >= face.x and
                    unique_face.y >= face.y and
                    (unique_face.x + unique_face.width) <= (face.x + face.width) and
                    (unique_face.y + unique_face.height) <= (face.y + face.height)
                )
                
                # Check either containment or high IoU
                if contained or face.calculate_iou(unique_face) > iou_threshold:
                    is_duplicate = True
                    break
                    
            if not is_duplicate:
                unique_faces.append(face)
        
        return unique_faces
    
    def crop_face(self, img: np.ndarray, face: FaceDetection) -> Optional[np.ndarray]:
        """Create a square crop of the face with consistent padding."""
        img_height, img_width = img.shape[:2]
        
        # Calculate padding based on face dimensions
        face_size = max(face.width, face.height)
        padding = int(face_size * (self.padding_percent / 100))
        
        # Calculate crop size including padding
        crop_size = face_size + (2 * padding)
        
        # Calculate center of face
        center_x = face.x + face.width // 2
        center_y = face.y + face.height // 2
        
        # Calculate crop boundaries with padding
        start_x = center_x - crop_size // 2
        start_y = center_y - crop_size // 2
        end_x = start_x + crop_size
        end_y = start_y + crop_size
        
        # Handle boundary conditions
        if start_x < 0:
            # Shift crop right
            end_x -= start_x
            start_x = 0
        if start_y < 0:
            # Shift crop down
            end_y -= start_y
            start_y = 0
        if end_x > img_width:
            # Shift crop left
            start_x -= (end_x - img_width)
            end_x = img_width
        if end_y > img_height:
            # Shift crop up
            start_y -= (end_y - img_height)
            end_y = img_height
            
        # Ensure boundaries are within image
        start_x = max(0, min(start_x, img_width))
        start_y = max(0, min(start_y, img_height))
        end_x = max(0, min(end_x, img_width))
        end_y = max(0, min(end_y, img_height))
        
        # Extract the crop
        crop = img[start_y:end_y, start_x:end_x].copy()
        
        # Ensure square crop
        height, width = crop.shape[:2]
        if height != width:
            min_dim = min(height, width)
            if height > width:
                # Crop height to match width
                excess = height - width
                crop = crop[excess//2:excess//2 + min_dim, :]
            else:
                # Crop width to match height
                excess = width - height
                crop = crop[:, excess//2:excess//2 + min_dim]
        
        return crop
    
    def visualize_detections(self, img: np.ndarray, faces: List[FaceDetection]) -> np.ndarray:
        """Draw bounding boxes and confidence scores on the image."""
        # Make a copy to avoid modifying the original
        viz_img = img.copy()
        
        for face in faces:
            # Draw rectangle
            cv2.rectangle(
                viz_img,
                (face.x, face.y),
                (face.x + face.width, face.y + face.height),
                (0, 255, 0),  # Green color
                2  # Line thickness
            )
            
            # Prepare confidence score text
            conf_text = f"{face.confidence:.2f}"
            
            # Get text size for better positioning
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.5
            thickness = 1
            (text_width, text_height), baseline = cv2.getTextSize(
                conf_text, font, font_scale, thickness
            )
            
            # Draw background rectangle for text
            cv2.rectangle(
                viz_img,
                (face.x, face.y - text_height - 5),
                (face.x + text_width + 5, face.y),
                (0, 255, 0),
                -1  # Filled rectangle
            )
            
            # Draw confidence score
            cv2.putText(
                viz_img,
                conf_text,
                (face.x + 2, face.y - 5),
                font,
                font_scale,
                (0, 0, 0),  # Black text
                thickness
            )
            
        return viz_img 