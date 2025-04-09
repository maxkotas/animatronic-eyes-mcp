// MCP Server for Animatronic Eyes Control
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
// Removed: import { ExpressServerTransport } from '@modelcontextprotocol/sdk/server/express.js'; // Module not found
import { z } from 'zod';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
// Removed: import express from 'express'; // Only needed for HTTP transport
// Removed: import cors from 'cors'; // Only needed for HTTP transport

// Configuration - adjust these values as needed
const SERIAL_PORT = process.env.SERIAL_PORT || '/dev/tty.usbserial-0001'; // Try the 'cu' device
const BAUD_RATE = 115200;
// Removed: const HTTP_PORT = process.env.PORT || 3000; // Only needed for HTTP transport

// Enhanced debugging
console.log(`Starting with serial port: ${SERIAL_PORT} at ${BAUD_RATE} baud`);

// Create MCP server
const server = new McpServer({
  name: 'Animatronic Eyes Control',
  version: '1.0.0',
  description: 'A service that controls animatronic eyes via Arduino',
});

// Serial port setup
let port;
let parser;
let connected = false;

async function setupSerialConnection() {
  try {
    console.log(`Attempting to connect to serial port: ${SERIAL_PORT}...`);
    port = new SerialPort({
      path: SERIAL_PORT,
      baudRate: BAUD_RATE,
      autoOpen: false,
    });
    
    // Attach parser immediately
    parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
    
    // Set up error and close handlers
    port.on('error', (err) => {
      console.error('*** Serial port error event received: ***', err.message); // Added logging
      console.log('*** Setting connected = false due to port error event. ***'); // Added logging
      connected = false;
    });
    
    port.on('close', (err) => { // Add err parameter if provided
      console.log('*** Serial port close event received. ***');
      if (err) {
        console.error('*** Close event error: ***', err.message);
      } else {
        console.log('*** Close event occurred without an explicit error. ***');
      }
      console.log('*** Setting connected = false due to port close event. ***');
      connected = false;
    });
    
    return new Promise((resolve) => {
      port.open(async (openErr) => {
        if (openErr) {
          console.error(`Failed to open serial port ${SERIAL_PORT}:`, openErr.message);
          return resolve(false);
        }
        console.log(`Serial port ${SERIAL_PORT} opened successfully.`);
  
        // --- Attempt programmatic reset via DTR toggle ---
        console.log('Attempting programmatic reset via DTR toggle...');
        await new Promise(resolve => port.set({ dtr: false }, resolve)); // Set DTR low
        await new Promise(res => setTimeout(res, 100)); // Wait 100ms
        await new Promise(resolve => port.set({ dtr: true }, resolve)); // Set DTR high (reset trigger)
        console.log('DTR toggled. Waiting for Arduino to boot...');
        await new Promise(res => setTimeout(res, 1500)); // Wait 1.5 seconds for boot after reset
        console.log('Proceeding to listen for "Ready" message...');
        // --- End programmatic reset ---
  
        let readyReceived = false;
  
        const readyPromise = new Promise((resolveReady, rejectReady) => {
          const readyTimeout = setTimeout(() => {
            if (!readyReceived) {
              console.warn('Warning: Timed out waiting for "Ready" message from Arduino.');
              rejectReady(new Error('Arduino ready timeout post-open'));
            }
          }, 10000); // 10 seconds timeout
  
          // Attach the listener on the already created parser
          parser.on('data', function onData(data) {
            console.log(`[Arduino]: ${data}`);
            if (data.trim() === 'Animatronic Eyes Ready') {
              console.log('Received "Ready" message from Arduino.');
              readyReceived = true;
              clearTimeout(readyTimeout);
              // Optionally remove the listener if you no longer need it
              parser.off('data', onData);
              resolveReady();
            }
          });
  
          parser.on('error', (parserErr) => {
            console.error('ReadlineParser error:', parserErr.message);
            clearTimeout(readyTimeout);
            rejectReady(parserErr);
          });
        });
  
        try {
          await readyPromise;
          console.log('Serial port opened and Arduino is ready.');
          connected = true;
          resolve(true);
        } catch (error) {
          console.error(`Failed to establish full connection after port open: ${error.message}`);
          connected = false;
          if (port && port.isOpen) {
            port.close((closeErr) => {
              if (closeErr) console.error('Error closing port after setup failure:', closeErr.message);
            });
          }
          resolve(false);
        }
      });
    });
  } catch (error) {
    console.error('Failed to setup serial connection:', error.message);
    console.error('Error stack:', error.stack);
    return false;
  }
}

// Returns null on success, or a specific error string on failure.
async function sendCommand(command) {
  console.log(`>>> sendCommand called with: "${command}"`);
  console.log(`>>> Current state: port exists=${!!port}, port.isOpen=${port ? port.isOpen : 'N/A'}, connected flag=${connected}`);

  if (!port) {
    const errorMsg = 'Serial port object does not exist.';
    console.error(`*** FAILURE POINT 1: ${errorMsg} ***`);
    return errorMsg;
  }
  if (!port.isOpen) {
    const errorMsg = `Serial port ${SERIAL_PORT} is not open.`;
    console.error(`*** FAILURE POINT 2: ${errorMsg} ***`);
    return errorMsg;
  }
  if (!connected) {
    const errorMsg = 'Connection flag is false (setup failed or port closed).';
     console.error(`*** FAILURE POINT 3: ${errorMsg} ***`);
     return errorMsg;
  }
 
  // Wrap port.write in a Promise
  return new Promise((resolve) => {
    try {
      console.log(`Sending command to Arduino: ${command}`);
      console.log(`>>> State just before write: port.isOpen=${port.isOpen}, connected=${connected}`); // Added more logging
      port.write(command + '\n', (err) => {
        if (err) {
          const errorMsg = `Error writing command "${command}" to serial port: ${err.message}`;
          console.error(`*** FAILURE POINT 4: ${errorMsg} ***`);
          resolve(errorMsg); // Resolve promise with error message on write error
        } else {
          console.log(`>>> Command "${command}" write initiated successfully.`);
          resolve(null); // Resolve promise with null on successful write initiation
        }
      });
    } catch (error) {
      const errorMsg = `Synchronous error during port.write setup: ${error.message}`;
      console.error(`*** FAILURE POINT 5: ${errorMsg} ***`);
      console.error('Error stack:', error.stack);
      resolve(errorMsg); // Resolve promise with error message on synchronous error
    }
  });
}

// --- Leftover comment removed ---
// Define MCP tools

// 1. Move Eyes (horizontal and vertical position)
server.tool(
  'moveEyes',
  {
    horizontal: z.number().int().min(0).max(180).describe('Horizontal position (0-180)'),
    vertical: z.number().int().min(0).max(180).describe('Vertical position (0-180)'),
  },
  async ({ horizontal, vertical }) => {
    const command = `MOVE ${horizontal} ${vertical}`;
    const errorResult = await sendCommand(command); // Returns null on success, error string on failure
    
    return {
      content: [
        {
          type: 'text',
          text: errorResult === null
            ? `Eyes moved to position: horizontal=${horizontal}, vertical=${vertical}`
            : `Failed to send command: ${errorResult}`, // Use specific error
        },
      ],
      isError: errorResult !== null // Indicate error in the result if sendCommand failed
    };
  }
);

// 2. Set Eyelids (openness percentage)
server.tool(
  'setEyelids',
  {
    openness: z.number().min(0).max(100).describe('Eyelid openness percentage (0-100)'),
  },
  async ({ openness }) => {
    const command = `EYELIDS ${openness}`;
    const errorResult = await sendCommand(command); // Returns null on success, error string on failure
    
    return {
      content: [
        {
          type: 'text',
          text: errorResult === null
            ? `Eyelids set to ${openness}% open`
            : `Failed to send command: ${errorResult}`, // Use specific error
        },
      ],
      isError: errorResult !== null // Indicate error in the result if sendCommand failed
    };
  }
);

// 3. Blink
server.tool(
  'blink',
  {},
  async () => {
    const command = 'BLINK';
    const errorResult = await sendCommand(command); // Returns null on success, error string on failure
    
    return {
      content: [
        {
          type: 'text',
          text: errorResult === null
            ? 'Triggered blink animation'
            : `Failed to send command: ${errorResult}`, // Use specific error
        },
      ],
      isError: errorResult !== null // Indicate error in the result if sendCommand failed
    };
  }
);

// 4. Look At (predefined positions)
server.tool(
  'lookAt',
  {
    target: z.enum(['left', 'right', 'up', 'down', 'center'])
      .describe('Direction to look (left, right, up, down, center)'),
  },
  async ({ target }) => {
    console.log(`>>> lookAt tool handler entered with target: ${target}`); // Add entry log
    // Map directions to approximate horizontal/vertical values
    const positions = {
      left: { h: 140, v: 90 }, // Swapped h with right
      right: { h: 40, v: 90 }, // Swapped h with left
      up: { h: 90, v: 140 }, // Swapped v with down
      down: { h: 90, v: 40 }, // Swapped v with up
      center: { h: 90, v: 90 },
    };
    
    const { h, v } = positions[target];
    const command = `MOVE ${h} ${v}`;
    const errorResult = await sendCommand(command); // Returns null on success, error string on failure
    
    return {
      content: [
        {
          type: 'text',
          text: errorResult === null
            ? `Eyes looking ${target}`
            : `Failed to send command: ${errorResult}`, // Use specific error
        },
      ],
      isError: errorResult !== null // Indicate error in the result if sendCommand failed
    };
  }
);

// 5. Random Movement (enable/disable)
server.tool(
  'randomMovement',
  {
    enable: z.boolean().describe('Enable or disable random eye movements'),
  },
  async ({ enable }) => {
    const command = `RANDOM ${enable ? '1' : '0'}`;
    const errorResult = await sendCommand(command); // Returns null on success, error string on failure
    
    return {
      content: [
        {
          type: 'text',
          text: errorResult === null
            ? `Random eye movements ${enable ? 'enabled' : 'disabled'}`
            : `Failed to send command: ${errorResult}`, // Use specific error
        },
      ],
      isError: errorResult !== null // Indicate error in the result if sendCommand failed
    };
  }
);

// Main function
async function main() {
  console.log('Starting Animatronic Eyes MCP Server...');
  
  // List available ports for debugging
  try {
    const { SerialPort } = await import('serialport');
    const ports = await SerialPort.list();
    console.log('Available serial ports:');
    ports.forEach(port => {
      console.log(`- ${port.path} (${port.manufacturer || 'unknown manufacturer'})`);
    });
  } catch (err) {
    console.error('Error listing serial ports:', err.message);
  }
  
  // Setup serial connection
  const serialConnected = await setupSerialConnection();
  if (!serialConnected) {
    console.warn('Warning: Continuing without Arduino connection. Commands will not be sent to hardware.');
  }
  
  // Removed HTTP server setup
  
  // Create both transports
  const stdioTransport = new StdioServerTransport();
  // Removed HTTP transport creation
  
  // Connect the server to both transports
  await server.connect(stdioTransport);
  // Removed: await server.connect(httpTransport);
  
  // Removed HTTP server start
  console.log(`MCP Server connected via Stdio and ready.`);

  // --- Startup Test Call Removed ---
}

// Start the server
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
