# MCP Server Integration Guide for Animatronic Eyes

This guide explains how to set up and use the MCP server to control your animatronic eyes.

## Files Included

1. `index.js` - The Node.js MCP server implementation
2. `package.json` - Node.js project configuration
3. `animatronic_eyes_mcp.ino` - Modified Arduino code for MCP control

## Setup Instructions

### 1. Arduino Setup

1. Connect your Arduino to your computer via USB
2. Open the Arduino IDE
3. Load the `animatronic_eyes_mcp.ino` file
4. Upload the code to your Arduino
5. Note the serial port your Arduino is connected to (e.g., COM3 on Windows, /dev/ttyUSB0 on Linux)

### 2. MCP Server Setup

1. Install Node.js if not already installed
2. Navigate to the `animatronic-eyes-mcp` directory
3. Install dependencies:
   ```
   npm install
   ```
4. Set the correct serial port (if different from default):
   ```
   export SERIAL_PORT=/dev/ttyUSB0  # Linux/Mac
   set SERIAL_PORT=COM3             # Windows
   ```
5. Start the MCP server:
   ```
   npm start
   ```

### 3. Cursor Integration

To integrate with Cursor, add the following to your `~/.cursor/mcp.json` file:

```json
{
  "mcpServers": {
    "animatronic-eyes-mcp": {
      "command": "node",
      "args": [
        "/path/to/animatronic-eyes-mcp/index.js"
      ]
    }
  }
}
```

Replace `/path/to/` with the actual path to the directory.

### 4. Claude Integration

To integrate with Claude, follow the MCP integration instructions for Claude, pointing to the MCP server's location.

## Available Commands

The MCP server provides the following tools:

1. **moveEyes(horizontal, vertical)**
   - Move eyes to specific position
   - Parameters:
     - horizontal: 0-180 (left to right)
     - vertical: 0-180 (up to down)

2. **setEyelids(openness)**
   - Control eyelid position
   - Parameters:
     - openness: 0-100 (percentage open)

3. **blink()**
   - Trigger a natural blink animation

4. **lookAt(target)**
   - Move eyes to predefined position
   - Parameters:
     - target: "left", "right", "up", "down", or "center"

5. **randomMovement(enable)**
   - Enable or disable random eye movements
   - Parameters:
     - enable: true/false

## Example Usage in Claude or Cursor

```
// Move eyes to specific position
moveEyes(120, 90)

// Make eyes look left
lookAt("left")

// Set eyelids half open
setEyelids(50)

// Trigger a blink
blink()

// Disable random movements
randomMovement(false)
```

## Troubleshooting

1. **Serial Connection Issues**
   - Verify the correct port is set
   - Check Arduino is properly connected
   - Ensure no other program is using the serial port

2. **MCP Server Not Starting**
   - Check Node.js is installed
   - Verify all dependencies are installed
   - Check for errors in the console

3. **Commands Not Working**
   - Ensure Arduino is running the correct code
   - Check serial communication is established
   - Verify command syntax is correct
