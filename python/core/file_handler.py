"""
File Handler Module
Manages saving ASCII art to files
"""

import os
import json
from datetime import datetime


class FileHandler:
    def __init__(self, output_dir='output'):
        self.output_dir = output_dir
        self.ensure_output_dir()
    
    def ensure_output_dir(self):
        """Create output directory if it doesn't exist"""
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)
    
    def save_ascii_text(self, ascii_art, filename=None):
        """Save ASCII art to a text file"""
        if filename is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f'ascii_{timestamp}.txt'
        
        filepath = os.path.join(self.output_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(ascii_art)
        
        return filepath
    
    def save_ascii_html(self, ascii_art, filename=None):
        """Save ASCII art as HTML with styling"""
        if filename is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f'ascii_{timestamp}.html'
        
        html_template = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>ASCII Art</title>
    <style>
        body {{
            background: #0a0a0f;
            color: #bf00ff;
            font-family: 'Courier New', monospace;
            padding: 20px;
            margin: 0;
        }}
        pre {{
            font-size: 8px;
            line-height: 1;
            text-shadow: 0 0 5px rgba(191, 0, 255, 0.5);
            white-space: pre;
        }}
    </style>
</head>
<body>
    <pre>{ascii_art}</pre>
</body>
</html>"""
        
        filepath = os.path.join(self.output_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html_template)
        
        return filepath
    
    def save_history_entry(self, ascii_art, options, history_file='history.json', is_gif=False, frames=None, delays=None):
        """Save entry to history"""
        history_path = os.path.join(self.output_dir, history_file)
        
        # Load existing history
        history = []
        if os.path.exists(history_path):
            try:
                with open(history_path, 'r', encoding='utf-8') as f:
                    history = json.load(f)
            except:
                history = []
        
        # Add new entry
        entry = {
            'timestamp': datetime.now().isoformat(),
            'ascii': ascii_art,  # Store full ASCII art (or first frame for GIFs)
            'preview': ascii_art[:500],  # Store preview for gallery display
            'options': options,
            'isGif': is_gif
        }
        
        # Add GIF-specific data if applicable
        if is_gif and frames and delays:
            entry['frames'] = frames
            entry['delays'] = delays
        
        history.append(entry)
        
        # Keep last 50 entries
        history = history[-50:]
        
        # Save history
        with open(history_path, 'w', encoding='utf-8') as f:
            json.dump(history, f, indent=2)
        
        return history_path
    
    def delete_history_entry(self, index, history_file='history.json'):
        """Delete entry from history by index"""
        history_path = os.path.join(self.output_dir, history_file)
        
        # Load existing history
        history = []
        if os.path.exists(history_path):
            try:
                with open(history_path, 'r', encoding='utf-8') as f:
                    history = json.load(f)
            except:
                return False
        
        # Delete entry if index is valid
        if 0 <= index < len(history):
            history.pop(index)
            
            # Save updated history
            with open(history_path, 'w', encoding='utf-8') as f:
                json.dump(history, f, indent=2)
            
            return True
        
        return False
