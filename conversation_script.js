import { GoogleGenerativeAI } from '@google/generative-ai';
import { McpClient } from '@modelcontextprotocol/sdk/client/mcp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

// --- Configuration ---
// IMPORTANT: Replace with your actual Gemini API Key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY';
const MCP_SERVER_COMMAND = 'node'; // Command to start the MCP server
const MCP_SERVER_ARGS = ['index.js']; // Arguments for the MCP server command
const MCP_SERVER_CWD = '.'; // Working directory for the MCP server

// --- Global Variables ---
let mcpClient = null;
let genAI = null;
let chat = null;
const rl = readline.createInterface({ input, output });

// --- MCP Eye Control Functions ---

async function callMcpTool(toolName, args = {}) {
    if (!mcpClient || !mcpClient.isConnected) {
        console.warn(`MCP client not connected. Cannot call tool: ${toolName}`);
        return null; // Indicate failure or inability to call
    }
    try {
        console.log(`[MCP Call] Tool: ${toolName}, Args: ${JSON.stringify(args)}`);
        const result = await mcpClient.useTool(toolName, args);
        console.log(`[MCP Result] ${toolName}:`, result.content?.[0]?.text || 'No text content');
        if (result.isError) {
             console.error(`[MCP Error] ${toolName}:`, result.content?.[0]?.text || 'Unknown error');
             return null; // Indicate failure
        }
        return result; // Return the full result object on success
    } catch (error) {
        console.error(`Error calling MCP tool ${toolName}:`, error);
        return null; // Indicate failure
    }
}

// Helper function for delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// State 1: Idle
async function setIdleState() {
    console.log("[State] Idle");
    await callMcpTool('randomMovement', { enable: true });
    await callMcpTool('setEyelids', { openness: 80 });
    // Add occasional slow blink logic if desired
}

// State 2: Listening
async function setListeningState() {
    console.log("[State] Listening");
    await callMcpTool('randomMovement', { enable: false });
    await callMcpTool('moveEyes', { horizontal: 90, vertical: 110 });
    await callMcpTool('setEyelids', { openness: 60 });
}

// State 3: Thinking
async function setThinkingState() {
    console.log("[State] Thinking");
    await callMcpTool('moveEyes', { horizontal: 90, vertical: 70 });
    await callMcpTool('setEyelids', { openness: 100 });
    // Add quick side glances if desired
}

// State 4: Processing
async function setProcessingState() {
    console.log("[State] Processing");
    await callMcpTool('lookAt', { target: 'center' });
    await callMcpTool('blink');
    await delay(150); // Small delay between blinks
    await callMcpTool('blink');
    await callMcpTool('setEyelids', { openness: 75 });
}

// State 5: Speaking
async function setSpeakingState() {
    console.log("[State] Speaking");
    await callMcpTool('lookAt', { target: 'center' }); // Ensure centered
    await callMcpTool('setEyelids', { openness: 75 });
    // Add occasional blinks during speech if desired
}

// --- Initialization ---

async function initializeMcpClient() {
    try {
        console.log('Initializing MCP Client...');
        const transport = new StdioClientTransport({
            command: MCP_SERVER_COMMAND,
            args: MCP_SERVER_ARGS,
            cwd: MCP_SERVER_CWD,
        });
        mcpClient = new McpClient({ transport });

        mcpClient.on('connected', () => console.log('MCP Client Connected'));
        mcpClient.on('disconnected', () => console.log('MCP Client Disconnected'));
        mcpClient.on('error', (error) => console.error('MCP Client Error:', error));

        await mcpClient.connect();

        if (mcpClient.isConnected) {
             console.log('MCP Client connection successful.');
             await delay(2000); // Give server time to fully initialize (especially serial)
             return true;
        } else {
             console.error('MCP Client failed to connect.');
             return false;
        }
    } catch (error) {
        console.error('Failed to initialize MCP Client:', error);
        return false;
    }
}

async function initializeGemini() {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
        console.error("Error: GEMINI_API_KEY is not set. Please set it in the script or environment.");
        return false;
    }
    try {
        console.log('Initializing Gemini AI...');
        genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"}); // Using 1.5 Flash as requested
        chat = model.startChat({
            history: [], // Start with empty history
            generationConfig: {
                // Optional: configure generation parameters
                // maxOutputTokens: 200,
            }
        });
        console.log('Gemini AI Initialized.');
        return true;
    } catch (error) {
        console.error('Failed to initialize Gemini AI:', error);
        return false;
    }
}

// --- Main Conversation Loop ---

async function main() {
    console.log("Starting Conversation Script...");

    const mcpReady = await initializeMcpClient();
    if (!mcpReady) {
        console.error("Exiting due to MCP client initialization failure.");
        process.exit(1);
    }

    const geminiReady = await initializeGemini();
    if (!geminiReady) {
        console.error("Exiting due to Gemini AI initialization failure.");
        // Optionally disconnect MCP client cleanly here if needed
        await mcpClient?.disconnect();
        process.exit(1);
    }

    console.log("\nAnimatronic AI Assistant Ready!");
    console.log("Type 'quit' or 'exit' to end the conversation.");

    await setIdleState(); // Initial state

    try {
        while (true) {
            await setListeningState(); // Eyes listen while waiting for input
            const userInput = await rl.question('You: ');

            if (userInput.toLowerCase() === 'quit' || userInput.toLowerCase() === 'exit') {
                break;
            }

            await setThinkingState(); // Eyes think while sending to AI

            let aiResponseText = '';
            try {
                const result = await chat.sendMessage(userInput);
                const response = await result.response;
                aiResponseText = await response.text();

                await setProcessingState(); // Eyes process before speaking
                await delay(500); // Pause before speaking
                await setSpeakingState(); // Eyes speak

                console.log(`AI: ${aiResponseText}`);
                // Add logic here for blinking during speech if desired

            } catch (error) {
                console.error("Error getting response from Gemini:", error);
                aiResponseText = "Sorry, I encountered an error.";
                 await setIdleState(); // Revert to idle on error
                console.log(`AI: ${aiResponseText}`);
            }

             await delay(1000); // Pause after AI speaks
             await setIdleState(); // Return to idle state after interaction
        }
    } catch (error) {
        console.error("An error occurred in the main loop:", error);
    } finally {
        console.log('\nExiting conversation.');
        await setIdleState(); // Set a final state
        await mcpClient?.disconnect();
        rl.close();
    }
}

main();