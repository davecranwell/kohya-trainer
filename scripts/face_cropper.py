import cv2
import numpy as np
from pathlib import Path
import argparse
from dataclasses import dataclass
from typing import List, Tuple, Optional

@dataclass
class FaceDetection:
    x: int
    y: int
    width: int
    height: int
    confidence: float = 0.0  # Add confidence score
    
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
    def __init__(self, padding_percent: float = 50):
        # Load cascade classifiers once during initialization
        self.cascades = {
            'front': cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'),
            'profile': cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml'),
            'alt': cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt.xml')
        }
        self.padding_percent = padding_percent
        
    def detect_faces(self, gray_img: np.ndarray) -> List[FaceDetection]:
        """Detect faces using multiple cascades and multiple rotations."""
        all_faces = []
        
        # Base parameters
        base_params = {
            'scaleFactor': 1.2,
            'minSize': (30, 30),
            'flags': cv2.CASCADE_SCALE_IMAGE
        }
        
        detect_params = {**base_params, 'minNeighbors': 3}
        conf_params = {**base_params, 'minNeighbors': 6}
        
        # Calculate minimum face area (as percentage of image area)
        min_face_area_percent = 2.0  # Faces must be at least 2% of image area
        image_area = gray_img.shape[0] * gray_img.shape[1]
        min_face_area = (min_face_area_percent / 100.0) * image_area
        
        # Define rotation angles to try (in degrees)
        angles = [-90, -30, 0, 30, 90]
        
        height, width = gray_img.shape
        center = (width // 2, height // 2)
        
        for angle in angles:
            if angle != 0:
                M = cv2.getRotationMatrix2D(center, angle, 1.0)
                rotated = cv2.warpAffine(gray_img, M, (width, height))
            else:
                rotated = gray_img
            
            for cascade in self.cascades.values():
                detections = cascade.detectMultiScale(rotated, **detect_params)
                
                for (x, y, w, h) in detections:
                    # Check if face area is large enough
                    face_area = w * h
                    if face_area < min_face_area:
                        continue  # Skip faces that are too small relative to image
                    
                    # Process rotation if needed
                    if angle != 0:
                        corners = np.array([
                            [x, y],
                            [x + w, y],
                            [x + w, y + h],
                            [x, y + h]
                        ], dtype=np.float32)
                        
                        M_inv = cv2.getRotationMatrix2D(center, -angle, 1.0)
                        for i in range(len(corners)):
                            px = corners[i][0]
                            py = corners[i][1]
                            corners[i][0] = M_inv[0][0] * px + M_inv[0][1] * py + M_inv[0][2]
                            corners[i][1] = M_inv[1][0] * px + M_inv[1][1] * py + M_inv[1][2]
                        
                        x = int(np.min(corners[:, 0]))
                        y = int(np.min(corners[:, 1]))
                        w = int(np.max(corners[:, 0]) - x)
                        h = int(np.max(corners[:, 1]) - y)
                    
                    # Extract ROI from original image
                    x1, y1 = max(0, x), max(0, y)
                    x2, y2 = min(width, x + w), min(height, y + h)
                    roi = gray_img[y1:y2, x1:x2]
                    
                    # Skip if ROI is too small
                    if roi.shape[0] < 30 or roi.shape[1] < 30:
                        continue
                    
                    # Try to detect face in ROI with stricter parameters
                    strict_detections = cascade.detectMultiScale(roi, **conf_params)
                    
                    base_confidence = 1.0 if len(strict_detections) > 0 else 0.5
                    angle_penalty = abs(angle) / 90.0
                    
                    # Add size-based confidence boost
                    # Larger faces (relative to image) get higher confidence
                    size_ratio = face_area / image_area
                    size_boost = min(size_ratio * 5, 0.2)  # Cap the boost at 0.2
                    
                    confidence = (base_confidence * (1.0 - 0.2 * angle_penalty)) + size_boost
                    
                    all_faces.append(FaceDetection(x, y, w, h, confidence))
        
        return self._remove_duplicates(all_faces)
    
    def _remove_duplicates(self, faces: List[FaceDetection], iou_threshold: float = 0.5) -> List[FaceDetection]:
        """Remove overlapping detections using IoU, keeping highest confidence ones."""
        # Sort faces by confidence (highest first)
        faces = sorted(faces, key=lambda x: x.confidence, reverse=True)
        unique_faces = []
        
        for face in faces:
            is_duplicate = False
            for unique_face in unique_faces:
                if face.calculate_iou(unique_face) > iou_threshold:
                    is_duplicate = True
                    break
            if not is_duplicate:
                unique_faces.append(face)
        
        return unique_faces
    
    def crop_face(self, img: np.ndarray, face: FaceDetection) -> Optional[np.ndarray]:
        """Create a square crop of the face with consistent padding."""
        img_height, img_width = img.shape[:2]
        
        # Start with desired padding
        initial_padding = int(max(face.width, face.height) * (self.padding_percent / 100))
        crop_size = max(face.width, face.height) + (2 * initial_padding)
        
        # Calculate center of face
        center_x = face.x + face.width // 2
        center_y = face.y + face.height // 2
        
        # Calculate initial crop boundaries
        start_x = center_x - crop_size // 2
        start_y = center_y - crop_size // 2
        end_x = start_x + crop_size
        end_y = start_y + crop_size
        
        # If crop would go outside image bounds, adjust crop_size and padding
        if start_x < 0 or start_y < 0 or end_x > img_width or end_y > img_height:
            # Calculate maximum possible crop size based on image boundaries
            max_size_left = center_x * 2  # Maximum size if limited by left border
            max_size_right = (img_width - center_x) * 2  # Limited by right border
            max_size_top = center_y * 2  # Limited by top border
            max_size_bottom = (img_height - center_y) * 2  # Limited by bottom border
            
            # Use smallest constraint to ensure square fits within image
            crop_size = int(min(max_size_left, max_size_right, max_size_top, max_size_bottom))
            
            # Recalculate boundaries with new crop size
            start_x = center_x - crop_size // 2
            start_y = center_y - crop_size // 2
            end_x = start_x + crop_size
            end_y = start_y + crop_size
        
        # Ensure boundaries are within image
        start_x = max(0, start_x)
        start_y = max(0, start_y)
        end_x = min(img_width, end_x)
        end_y = min(img_height, end_y)
        
        # Extract the crop
        crop = img[start_y:end_y, start_x:end_x].copy()
        
        # At this point, crop might not be perfectly square due to boundary conditions
        # If so, reduce the larger dimension to match the smaller one
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

def process_image(
    image_path: Path,
    output_dir: Path,
    cropper: FaceCropper,
    mode: str = 'crop'
) -> bool:
    """Process a single image and save either crops or visualizations."""
    # Read and validate image
    img = cv2.imread(str(image_path))
    if img is None:
        print(f"Could not read image: {image_path}")
        return False
        
    # Convert to grayscale for detection
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Detect faces
    faces = cropper.detect_faces(gray)
    if not faces:
        print(f"No faces found in {image_path} - copying original file")
        # Copy original file to output directory
        output_path = output_dir / image_path.name
        cv2.imwrite(str(output_path), img)
        return True
    
    if mode == 'visualize':
        # Create visualization with bounding boxes
        viz_img = cropper.visualize_detections(img, faces)
        output_path = output_dir / f"{image_path.stem}_detected.jpg"
        cv2.imwrite(str(output_path), viz_img)
        print(f"Saved detection visualization for {image_path.name}")
        return True
    else:
        # Process each face as before (cropping mode)
        success = False
        for idx, face in enumerate(faces, 1):
            try:
                crop = cropper.crop_face(img, face)
                if crop is not None:
                    output_path = output_dir / f"{image_path.stem}_face_{idx}.jpg"
                    cv2.imwrite(str(output_path), crop)
                    success = True
                    print(f"Saved face {idx} from {image_path.name}")
            except Exception as e:
                print(f"Error processing face {idx} from {image_path.name}: {str(e)}")
                
        return success

def main():
    parser = argparse.ArgumentParser(description='Process faces in images')
    parser.add_argument('input_directory', help='Directory containing input images')
    parser.add_argument('output_directory', help='Directory to save processed images')
    parser.add_argument('--padding', type=float, default=50,
                       help='Padding around face as percentage (default: 50)')
    parser.add_argument('--mode', choices=['crop', 'visualize'], default='crop',
                       help='Processing mode: crop faces or visualize detections')
    
    args = parser.parse_args()
    
    input_dir = Path(args.input_directory)
    output_dir = Path(args.output_directory)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Initialize face cropper
    cropper = FaceCropper(padding_percent=args.padding)
    
    # Process all images
    valid_extensions = {'.jpg', '.jpeg', '.png', '.bmp'}
    for image_path in input_dir.iterdir():
        if image_path.suffix.lower() in valid_extensions:
            process_image(image_path, output_dir, cropper, args.mode)

if __name__ == "__main__":
    main() 