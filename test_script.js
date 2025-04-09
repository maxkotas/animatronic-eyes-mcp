// Test script for animatronic eyes MCP server
// This script simulates what would happen when the MCP server receives commands

import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

// Configuration - adjust these values as needed
const SERIAL_PORT = process.env.SERIAL_PORT || '/dev/ttyUSB0';
const BAUD_RATE = 115200;

// Test sequence to run
const testSequence = [
  { command: 'MOVE 90 90', description: 'Center eyes', delay: 1000 },
  { command: 'EYELIDS 100', description: 'Fully open eyelids', delay: 1000 },
  { command: 'BLINK', description: 'Trigger blink', delay: 1000 },
  { command: 'MOVE 40 90', description: 'Look left', delay: 1500 },
  { command: 'MOVE 140 90', description: 'Look right', delay: 1500 },
  { command: 'MOVE 90 40', description: 'Look up', delay: 1500 },
  { command: 'MOVE 90 140', description: 'Look down', delay: 1500 },
  { command: 'MOVE 90 90', description: 'Center eyes again', delay: 1000 },
  { command: 'EYELIDS 50', description: 'Half-open eyelids', delay: 1500 },
  { command: 'EYELIDS 100', description: 'Fully open eyelids', delay: 1000 },
  { command: 'RANDOM 0', description: 'Disable random movement', delay: 500 },
  { command: 'RANDOM 1', description: 'Enable random movement', delay: 500 }
];

// Setup serial connection
async function setupSerialConnection() {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Attempting to connect to ${SERIAL_PORT} at ${BAUD_RATE} baud...`);
      
      const port = new SerialPort({ 
        path: SERIAL_PORT, 
        baudRate: BAUD_RATE 
      });
      
      const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
      
      // Handle incoming data from Arduino
      parser.on('data', (data) => {
        console.log(`[Arduino]: ${data}`);
      });
      
      // Handle connection events
      port.on('open', () => {
        console.log(`Serial port ${SERIAL_PORT} opened successfully`);
        resolve({ port, parser });
      });
      
      port.on('error', (err) => {
        console.error('Serial port error:', err.message);
        reject(err);
      });
      
    } catch (error) {
      console.error('Failed to setup serial connection:', error.message);
      reject(error);
    }
  });
}

// Run test sequence
async function runTestSequence(port) {
  console.log('\n=== Starting Test Sequence ===\n');
  
  for (let i = 0; i < testSequence.length; i++) {
    const test = testSequence[i];
    console.log(`[Test ${i+1}/${testSequence.length}]: ${test.description}`);
    console.log(`Sending: ${test.command}`);
    
    // Send command
    port.write(test.command + '\n');
    
    // Wait for specified delay
    await new Promise(resolve => setTimeout(resolve, test.delay));
  }
  
  console.log('\n=== Test Sequence Completed ===\n');
}

// Main function
async function main() {
  try {
    // Connect to Arduino
    const { port } = await setupSerialConnection();
    
    // Wait for Arduino to initialize
    console.log('Waiting for Arduino to initialize...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Run test sequence
    await runTestSequence(port);
    
    // Close connection when done
    port.close();
    console.log('Serial port closed');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Start the test
main();
