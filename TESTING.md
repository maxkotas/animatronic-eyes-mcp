// MCP Server Integration Test Documentation
// This document describes the testing process and results for the animatronic eyes MCP server

# Testing Process

## Test Environment Setup

To properly test the MCP server integration with the animatronic eyes hardware, the following setup is required:

1. Arduino with PCA9685 servo driver connected to computer via USB
2. Servo motors connected to the PCA9685 driver as specified in the original code
3. Modified Arduino code (`animatronic_eyes_mcp.ino`) uploaded to the Arduino
4. Node.js environment with required dependencies installed

## Test Scenarios

The test script (`test_script.js`) runs through the following test scenarios:

1. **Basic Movement Test**
   - Center eyes (MOVE 90 90)
   - Look left (MOVE 40 90)
   - Look right (MOVE 140 90)
   - Look up (MOVE 90 40)
   - Look down (MOVE 90 140)
   - Return to center (MOVE 90 90)

2. **Eyelid Control Test**
   - Fully open eyelids (EYELIDS 100)
   - Half-open eyelids (EYELIDS 50)
   - Return to fully open (EYELIDS 100)

3. **Blink Function Test**
   - Trigger blink animation (BLINK)

4. **Random Movement Test**
   - Disable random movement (RANDOM 0)
   - Enable random movement (RANDOM 1)

## Expected Results

When the test script is run with the Arduino properly connected:

1. The eyes should move through all the specified positions smoothly
2. The eyelids should adjust to different openness levels
3. The eyes should perform a natural blink animation
4. Random movement should be disabled and then re-enabled

## Running the Tests

To run the tests:

1. Ensure Arduino is connected and running the modified code
2. Set the correct serial port if needed:
   ```
   export SERIAL_PORT=/dev/ttyUSB0  # Linux/Mac
   set SERIAL_PORT=COM3             # Windows
   ```
3. Run the test script:
   ```
   node test_script.js
   ```

# Integration Testing with AI Systems

## Testing with Cursor

To test the MCP server integration with Cursor:

1. Configure Cursor to use the MCP server as described in the README
2. Verify that Cursor can see the available tools
3. Test each tool individually:
   - `moveEyes(horizontal, vertical)`
   - `setEyelids(openness)`
   - `blink()`
   - `lookAt(target)`
   - `randomMovement(enable)`

## Testing with Claude

To test the MCP server integration with Claude:

1. Configure Claude to use the MCP server as described in the README
2. Verify that Claude can see the available tools
3. Test each tool individually with the same parameters as the Cursor test

# Troubleshooting Common Issues

1. **Serial Connection Errors**
   - Verify the correct port is specified
   - Check that no other program is using the serial port
   - Restart the Arduino if needed

2. **Command Not Recognized**
   - Verify the command format matches what the Arduino code expects
   - Check for any typos or syntax errors

3. **No Movement Response**
   - Verify servo connections
   - Check power supply to servos
   - Ensure servo limits are correctly set

4. **MCP Server Not Starting**
   - Check for Node.js errors
   - Verify all dependencies are installed
   - Check file paths and permissions
