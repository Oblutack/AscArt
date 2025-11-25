import sys
import json
import time

def main():
    while True:
        try:
            # Read input from Electron
            line = sys.stdin.readline()
            if not line:
                break
            
            data = json.loads(line)
            command = data.get('command')
            
            response = {}
            
            # Simple test command
            if command == 'ping':
                response = {"status": "success", "message": "Pong from Python!"}
            
            # We will add image processing logic here later

            # Send JSON back to Electron
            print(json.dumps(response))
            sys.stdout.flush() 

        except Exception as e:
            pass

if __name__ == '__main__':
    main()