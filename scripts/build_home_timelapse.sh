#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /path/to/inside_tl/edit" >&2
  exit 64
fi

source_dir=${1%/}
first_frame=6674
last_frame=6806
frames_per_second=12

for command_name in ffmpeg magick; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required command not found: $command_name" >&2
    exit 69
  fi
done

for frame_number in $(seq "$first_frame" "$last_frame"); do
  source_file="$source_dir/DSC_${frame_number}_edit.jpg"
  if [[ ! -f "$source_file" ]]; then
    echo "Missing source frame: $source_file" >&2
    exit 66
  fi
done

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repo_dir=$(cd "$script_dir/.." && pwd)
video_dir="$repo_dir/assets/video/portfolio"
image_dir="$repo_dir/assets/images/portfolio"
work_dir=$(mktemp -d "${TMPDIR:-/tmp}/krzkot-home-timelapse.XXXXXX")
sequence_dir="$work_dir/sequence"
output_dir="$work_dir/output"

cleanup() {
  rm -rf "$work_dir"
}
trap cleanup EXIT

mkdir -p "$sequence_dir" "$output_dir"

for frame_number in $(seq "$first_frame" "$last_frame"); do
  frame_index=$((frame_number - first_frame))
  printf -v output_name 'frame_%04d.jpg' "$frame_index"
  ln -s "$source_dir/DSC_${frame_number}_edit.jpg" "$sequence_dir/$output_name"
done

interpolate_frame() {
  local previous_frame=$1
  local next_frame=$2
  local previous_weight=$3
  local next_weight=$4
  local target_frame=$5
  local target_index=$((target_frame - first_frame))
  local target_file

  printf -v target_file '%s/frame_%04d.jpg' "$sequence_dir" "$target_index"
  rm "$target_file"

  ffmpeg -hide_banner -loglevel error -y \
    -i "$source_dir/DSC_${previous_frame}_edit.jpg" \
    -i "$source_dir/DSC_${next_frame}_edit.jpg" \
    -filter_complex "[0:v][1:v]blend=all_expr='A*${previous_weight}+B*${next_weight}'" \
    -frames:v 1 -q:v 2 "$target_file"
}

interpolate_frame 6707 6709 0.5 0.5 6708
interpolate_frame 6739 6741 0.5 0.5 6740
interpolate_frame 6774 6777 0.666667 0.333333 6775
interpolate_frame 6774 6777 0.333333 0.666667 6776

encode_video() {
  local width=$1
  local quality=$2
  local output_file=$3

  ffmpeg -hide_banner -loglevel error -y \
    -framerate "$frames_per_second" -start_number 0 \
    -i "$sequence_dir/frame_%04d.jpg" \
    -vf "scale=${width}:-2:flags=lanczos:in_range=pc:out_range=tv,format=yuv420p" \
    -an -c:v libx264 -preset slow -crf "$quality" \
    -g 6 -keyint_min 6 -sc_threshold 0 \
    -pix_fmt yuv420p -color_range tv -movflags +faststart "$output_file"
}

encode_video 1600 27 "$output_dir/home-telescope-1600.mp4"
encode_video 960 26 "$output_dir/home-telescope-960.mp4"

poster_source="$sequence_dir/frame_0000.jpg"

for width in 1920 960; do
  magick "$poster_source" -auto-orient -strip -resize "${width}x" \
    -quality 88 "$output_dir/hero-${width}.jpg"
  magick "$poster_source" -auto-orient -strip -resize "${width}x" \
    -quality 82 "$output_dir/hero-${width}.webp"
  magick "$poster_source" -auto-orient -strip -resize "${width}x" \
    -quality 58 "$output_dir/hero-${width}.avif"
done

mkdir -p "$video_dir" "$image_dir"
install -m 0644 "$output_dir/home-telescope-1600.mp4" "$video_dir/home-telescope-1600.mp4"
install -m 0644 "$output_dir/home-telescope-960.mp4" "$video_dir/home-telescope-960.mp4"

for width in 1920 960; do
  for extension in jpg webp avif; do
    install -m 0644 "$output_dir/hero-${width}.${extension}" "$image_dir/hero-${width}.${extension}"
  done
done

echo "Generated home timelapse assets:"
du -h "$video_dir/home-telescope-1600.mp4" "$video_dir/home-telescope-960.mp4"
