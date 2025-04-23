// MCP Server for Animatronic Eyes Control
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fetch from 'node-fetch'; // Import node-fetch

// Configuration
const ESP32_IP = '192.168.50.195'; // IP address of the ESP32 running the web server
const ESP32_PORT = 80; // Port the ESP32 web server is listening on
const ESP32_BASE_URL = `http://${ESP32_IP}:${ESP32_PORT}`;

// Enhanced debugging
console.log(`Configured to send commands to ESP32 at: ${ESP32_BASE_URL}`);

// Create MCP server
const server = new McpServer({
  name: 'Animatronic Eyes Control',
  version: '1.0.0',
  description: 'A service that controls animatronic eyes via Arduino',
});

// Helper function to send HTTP GET requests to the ESP32
// Returns null on success, or an error string on failure.
async function sendHttpRequest(path, params = {}) {
  const url = new URL(path, ESP32_BASE_URL);
  Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

  console.log(`Sending HTTP request to ESP32: ${url.toString()}`);

  try {
    const response = await fetch(url.toString(), { method: 'GET', timeout: 5000 }); // 5 second timeout

    if (!response.ok) {
      const errorText = await response.text();
      const errorMsg = `HTTP request failed: ${response.status} ${response.statusText} - ${errorText}`;
      console.error(`*** HTTP Error: ${errorMsg} ***`);
      return errorMsg;
    }

    const responseText = await response.text(); // Read the response body
    console.log(`ESP32 Response: ${responseText}`); // Log the response
    return null; // Indicate success

  } catch (error) {
    const errorMsg = `Error sending HTTP request: ${error.message}`;
    console.error(`*** Network/Fetch Error: ${errorMsg} ***`);
    console.error('Error stack:', error.stack);
    return errorMsg; // Indicate failure
  }
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
    const errorResult = await sendHttpRequest('/move', { h: horizontal, v: vertical });
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
    const errorResult = await sendHttpRequest('/eyelids', { openness });
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
    const errorResult = await sendHttpRequest('/blink');
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
    // The Arduino /move endpoint handles the actual movement
    const errorResult = await sendHttpRequest('/move', { h, v });
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
    const errorResult = await sendHttpRequest('/random', { enable: enable ? '1' : '0' });
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

// 6. Set Auto Blink (enable/disable)
server.tool(
  'setAutoBlink',
  {
    enable: z.boolean().describe('Enable or disable automatic blinking'),
  },
  async ({ enable }) => {
    const errorResult = await sendHttpRequest('/autoblink', { enable: enable ? '1' : '0' });
    return {
      content: [
        {
          type: 'text',
          text: errorResult === null
            ? `Automatic blinking ${enable ? 'enabled' : 'disabled'}`
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
  
  // No serial connection setup needed anymore
  // Create both transports
  const stdioTransport = new StdioServerTransport();
  // Removed HTTP transport creation
  
  // Connect the server to both transports
  await server.connect(stdioTransport);
  // Removed: await server.connect(httpTransport);
  
  // Removed HTTP server start
  console.log(`MCP Server ready. Configured to send commands to ${ESP32_BASE_URL}`);

}

// Start the server
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
