#!/usr/bin/env python3
"""
analyze_images.py - Command line tool for batch image quality analysis
"""

import json
import argparse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
import logging
from image_quality.analyzer import ImageQualityAnalyzer
import cv2

def process_directory(
    input_dir: str,
    output_dir: Path,
    mode: str = 'analyze',
    num_threads: int = 4,
    **analyzer_kwargs
) -> None:
    """Process all images in a directory"""
    analyzer = ImageQualityAnalyzer(**analyzer_kwargs)
    image_paths = []
    
    # Collect all image files
    for ext in ('*.jpg', '*.jpeg', '*.png'):
        image_paths.extend(Path(input_dir).glob(ext))
    
    if not image_paths:
        print(f"No images found in {input_dir}")
        return

    print(f"Processing {len(image_paths)} images...")

    results = []
    
    def process_image(path: Path):
        try:
            # Analyze image
            metrics = analyzer.analyze_image(str(path))
            results.append(asdict(metrics))
            
            # Handle visualization if requested
            if mode == 'visualize':
                # Read image with OpenCV for visualization
                img = cv2.imread(str(path))
                if img is not None:
                    viz_img = analyzer.visualize_analysis(img, metrics)
                    output_path = output_dir / f"{path.stem}_analyzed{path.suffix}"
                    cv2.imwrite(str(output_path), viz_img)
                    print(f"Saved visualization for {path.name}")
        except Exception as e:
            logging.error(f"Error processing {path}: {str(e)}")

    # Process images in parallel
    with ThreadPoolExecutor(max_workers=num_threads) as executor:
        list(executor.map(process_image, image_paths))

    # Get dataset summary
    summary = analyzer.get_dataset_summary()
    
    # Save results
    output = {
        'individual_results': results,
        'dataset_summary': summary
    }
    
    with open(output_dir / 'analysis_results.json', 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"\nResults saved to {output_dir}")
    print(f"\nSummary:")
    print(f"Total images: {summary['total_images']}")
    print(f"Accepted images: {summary['accepted_images']}")
    print("\nRejection reasons:")
    for reason, count in summary['rejection_reasons'].items():
        print(f"- {reason}: {count}")

def main():
    parser = argparse.ArgumentParser(description='Analyze image quality in a directory')
    parser.add_argument('input_directory', help='Directory containing input images')
    parser.add_argument('output_directory', help='Directory to save analysis results')
    parser.add_argument('--mode', choices=['analyze', 'visualize'], default='analyze',
                      help='Processing mode: analyze only or visualize analysis (default: analyze)')
    parser.add_argument('--threads', '-t', type=int, default=4,
                      help='Number of threads to use (default: 4)')
    # Quality thresholds
    parser.add_argument('--min-width', type=int, default=800,
                      help='Minimum acceptable width (default: 800)')
    parser.add_argument('--min-height', type=int, default=600,
                      help='Minimum acceptable height (default: 600)')
    parser.add_argument('--min-saturation', type=float, default=0.2,
                      help='Minimum acceptable saturation (default: 0.2)')
    parser.add_argument('--max-saturation', type=float, default=0.8,
                      help='Maximum acceptable saturation (default: 0.8)')
    parser.add_argument('--min-contrast', type=float, default=0.3,
                      help='Minimum acceptable contrast (default: 0.3)')
    parser.add_argument('--blur-threshold', type=float, default=100.0,
                      help='Blur detection threshold (default: 100.0)')
    
    args = parser.parse_args()
    
    # Create output directory if it doesn't exist
    output_dir = Path(args.output_directory)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    process_directory(
        args.input_directory,
        output_dir,
        mode=args.mode,
        num_threads=args.threads,
        min_width=args.min_width,
        min_height=args.min_height,
        min_saturation=args.min_saturation,
        max_saturation=args.max_saturation,
        min_contrast=args.min_contrast,
        blur_threshold=args.blur_threshold
    )

if __name__ == '__main__':
    main() 