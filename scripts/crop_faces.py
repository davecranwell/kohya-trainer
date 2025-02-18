#!/usr/bin/env python3
"""
crop_faces.py - Command line tool for detecting and cropping faces from images
"""

import cv2
from pathlib import Path
import argparse
from face_detection.detector import FaceCropper
from concurrent.futures import ThreadPoolExecutor
import logging

def process_directory(
    input_dir: str,
    output_dir: Path,
    mode: str = 'crop',
    num_threads: int = 4,
    **cropper_kwargs
) -> None:
    """Process all images in a directory"""
    cropper = FaceCropper(**cropper_kwargs)
    image_paths = []
    
    # Collect all image files
    valid_extensions = ('*.jpg', '*.jpeg', '*.png', '*.bmp')
    for ext in valid_extensions:
        image_paths.extend(Path(input_dir).glob(ext))
    
    if not image_paths:
        print(f"No images found in {input_dir}")
        return

    print(f"Processing {len(image_paths)} images...")
    
    def process_image(path: Path, output_dir: Path, cropper: FaceCropper, mode: str = 'crop') -> None:
        """Process a single image, saving all perfect confidence faces and the best lower confidence face."""
        try:
            # Read and validate image
            img = cv2.imread(str(path))
            if img is None:
                logging.error(f"Could not read image: {path}")
                return
                
            # Convert to grayscale for detection
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # Detect faces
            faces = cropper.detect_faces(gray)
            if not faces:
                print(f"No faces found in {path} - copying original file")
                # Copy original file to output directory
                output_path = output_dir / path.name
                cv2.imwrite(str(output_path), img)
                return
            
            if mode == 'visualize':
                # Create visualization with bounding boxes
                viz_img = cropper.visualize_detections(img, faces)
                output_path = output_dir / f"{path.stem}_detected{path.suffix}"
                cv2.imwrite(str(output_path), viz_img)
                print(f"Saved detection visualization for {path.name}")
            else:
                # Split faces into perfect confidence and others
                perfect_faces = [f for f in faces if f.confidence >= 0.95]  # Using 0.99 to account for floating point
                other_faces = [f for f in faces if f.confidence < 0.95]
                
                # Process all perfect confidence faces
                for idx, face in enumerate(perfect_faces, 1):
                    try:
                        crop = cropper.crop_face(img, face)
                        if crop is not None:
                            # Add index only if there are multiple perfect faces
                            suffix = f"_face_{idx}" if len(perfect_faces) > 1 else "_face"
                            output_path = output_dir / f"{path.stem}{suffix}{path.suffix}"
                            cv2.imwrite(str(output_path), crop)
                            print(f"Saved perfect confidence face {idx} from {path.name} (confidence: {face.confidence:.2f})")
                    except Exception as e:
                        logging.error(f"Error processing perfect face {idx} from {path.name}: {str(e)}")
                
                # Process the best lower confidence face if any exist and no perfect faces were found
                if other_faces and not perfect_faces:
                    best_face = other_faces[0]  # faces are already sorted by confidence
                    try:
                        crop = cropper.crop_face(img, best_face)
                        if crop is not None:
                            output_path = output_dir / f"{path.stem}_face{path.suffix}"
                            cv2.imwrite(str(output_path), crop)
                            print(f"Saved highest confidence face from {path.name} (confidence: {best_face.confidence:.2f})")
                    except Exception as e:
                        logging.error(f"Error processing face from {path.name}: {str(e)}")
        
        except Exception as e:
            logging.error(f"Error processing {path}: {str(e)}")

    # Process images in parallel if requested
    if num_threads > 1:
        with ThreadPoolExecutor(max_workers=num_threads) as executor:
            list(executor.map(lambda path: process_image(path, output_dir, cropper, mode), image_paths))
    else:
        for path in image_paths:
            process_image(path, output_dir, cropper, mode)
    
    print(f"\nResults saved to {output_dir}")

def main():
    parser = argparse.ArgumentParser(description='Process faces in images')
    parser.add_argument('input_directory', help='Directory containing input images')
    parser.add_argument('output_directory', help='Directory to save processed images')
    parser.add_argument('--mode', choices=['crop', 'visualize'], default='crop',
                       help='Processing mode: crop faces or visualize detections')
    parser.add_argument('--threads', '-t', type=int, default=4,
                       help='Number of threads to use (default: 4)')
    parser.add_argument('--padding', type=float, default=50,
                       help='Padding around face as percentage (default: 50)')
    
    args = parser.parse_args()
    
    # Create output directory if it doesn't exist
    output_dir = Path(args.output_directory)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    process_directory(
        args.input_directory,
        output_dir,
        mode=args.mode,
        num_threads=args.threads,
        padding_percent=args.padding
    )

if __name__ == "__main__":
    main() 