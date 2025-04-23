#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>
#include <WiFi.h>
#include <WebServer.h> // Using the standard WebServer library
#include "esp_wifi.h" // Include for esp_wifi_set_protocol()

// --- WiFi Credentials ---
const char* ssid = "KotasNetIoT";
const char* password = "8133rosemont";

// --- Web Server Setup ---
WebServer server(80); // Create a web server object on port 80

// --- PCA9685 Servo Driver Setup ---
Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver();

// Servo angle to PWM pulse width conversion
#define SERVO_MIN 100  // Pulse corresponding to 0 degrees
#define SERVO_MAX 500  // Pulse corresponding to 180 degrees

// --- PCA9685 Channel Definitions ---
#define SERVO_LR_CH  0  // Eye horizontal movement
#define SERVO_UD_CH  1  // Eye vertical movement
#define SERVO_TL_CH  2  // Top Left eyelid
#define SERVO_BL_CH  3  // Bottom Left eyelid
#define SERVO_TR_CH  4  // Top Right eyelid
#define SERVO_BR_CH  5  // Bottom Right eyelid

// --- Servo Angle Limits ---
struct ServoLimit { int minAngle; int maxAngle; };
ServoLimit limitsLR = {40, 140};  // Horizontal (left/right) limits
ServoLimit limitsUD = {40, 140};  // Vertical (up/down) limits

// Eyelid limits – these values position the lids naturally when open.
ServoLimit limitsTL = {90, 170};
ServoLimit limitsBL = {90, 10};
ServoLimit limitsTR = {90, 10};
ServoLimit limitsBR = {90, 160};

// --- Helper to Write Servo Angle via PCA9685 ---
void writeServo(uint8_t channel, int angle) {
  int pulse = map(angle, 0, 180, SERVO_MIN, SERVO_MAX);
  pwm.setPWM(channel, 0, pulse);
}

// --- Calibration (Centers All Servos) ---
void calibrate() {
  writeServo(SERVO_LR_CH, 90);
  writeServo(SERVO_UD_CH, 90);
  writeServo(SERVO_TL_CH, 90);
  writeServo(SERVO_BL_CH, 90);
  writeServo(SERVO_TR_CH, 90);
  writeServo(SERVO_BR_CH, 90);
}

// --- Sets the Eyelids to the "Open" Position Based on the UD Angle ---
void setEyesOpen(int ud_angle) {
  writeServo(SERVO_UD_CH, ud_angle);
  float ud_progress = (float)(ud_angle - limitsUD.minAngle) / (limitsUD.maxAngle - limitsUD.minAngle);

  int tl_target = limitsTL.maxAngle - ((limitsTL.maxAngle - limitsTL.minAngle) * (0.8 * (1 - ud_progress)));
  int tr_target = limitsTR.maxAngle + ((limitsTR.minAngle - limitsTR.maxAngle) * (0.8 * (1 - ud_progress)));
  int bl_target = limitsBL.maxAngle + ((limitsBL.minAngle - limitsBL.maxAngle) * (0.4 * ud_progress));
  int br_target = limitsBR.maxAngle - ((limitsBR.maxAngle - limitsBR.minAngle) * (0.4 * ud_progress));

  writeServo(SERVO_TL_CH, tl_target);
  writeServo(SERVO_TR_CH, tr_target);
  writeServo(SERVO_BL_CH, bl_target);
  writeServo(SERVO_BR_CH, br_target);
}

// --- Set Eyelids Openness Percentage ---
void setEyelidsOpenness(int percentage) {
  // Map percentage (0-100) to eyelid positions
  // 0% = fully closed, 100% = fully open
  int tl_angle = map(percentage, 0, 100, limitsTL.minAngle, limitsTL.maxAngle);
  int tr_angle = map(percentage, 0, 100, limitsTR.minAngle, limitsTR.maxAngle);
  int bl_angle = map(percentage, 0, 100, limitsBL.minAngle, limitsBL.maxAngle);
  int br_angle = map(percentage, 0, 100, limitsBR.minAngle, limitsBR.maxAngle);

  writeServo(SERVO_TL_CH, tl_angle);
  writeServo(SERVO_TR_CH, tr_angle);
  writeServo(SERVO_BL_CH, bl_angle);
  writeServo(SERVO_BR_CH, br_angle);
}

// --- Blink Function ---
// Closes the eyelids (a "blink" is performed by quickly closing and reopening).
void closeEyes() {
  writeServo(SERVO_TL_CH, limitsTL.minAngle);
  writeServo(SERVO_TR_CH, limitsTR.minAngle);
  writeServo(SERVO_BL_CH, limitsBL.minAngle);
  writeServo(SERVO_BR_CH, limitsBR.minAngle);
}

// --- Global Variables for Eye Movement & Blinking ---
int currentLR = 90;  // Current horizontal position
int currentUD = 90;  // Current vertical position
int targetLR = 90;   // Target horizontal position
int targetUD = 90;   // Target vertical position

unsigned long nextTargetTime = 0;  // Time to choose a new eye position
unsigned long nextBlinkTime = 0;   // Next scheduled blink time

// Blink state machine
bool blinking = false;
enum BlinkPhase { NONE, CLOSING, OPENING };
BlinkPhase blinkPhase = NONE;
unsigned long blinkStartTime = 0;
const unsigned long blinkCloseDuration = 100; // Duration (ms) to keep eyes closed
const unsigned long blinkOpenDuration  = 100; // Duration (ms) after opening before resuming

// --- Control Variables ---
bool randomMovementEnabled = false; // Disable random movement by default
bool autoBlinkingEnabled = true;    // Enable automatic blinking by default

// --- Incremental Angle Update ---
// Moves the current angle toward the target by a defined step size.
int updateAngle(int current, int target) {
  int diff = target - current;
  int step = 3;  // Increased step size for faster movement
  if (abs(diff) <= step)
    return target;
  if (diff > 0)
    return current + step;
  else
    return current - step;
}

// --- HTTP Handlers ---

// Handle root request
void handleRoot() {
  String html = "<html><body><h1>Animatronic Eyes Control</h1>";
  html += "<p>Use endpoints like:</p>";
  html += "<ul>";
  html += "<li>/move?h=90&v=90</li>";
  html += "<li>/eyelids?openness=50</li>";
  html += "<li>/blink</li>";
  html += "<li>/random?enable=1 (or 0)</li>";
  html += "<li>/autoblink?enable=1 (or 0)</li>";
  html += "</ul>";
  html += "<p>Current Status:<br>";
  html += "LR Target: " + String(targetLR) + "<br>";
  html += "UD Target: " + String(targetUD) + "<br>";
  html += "Random Movement: " + String(randomMovementEnabled ? "Enabled" : "Disabled") + "<br>";
  html += "Auto Blinking: " + String(autoBlinkingEnabled ? "Enabled" : "Disabled") + "<br>";
  html += "</p></body></html>";
  server.send(200, "text/html", html);
}

// Handle /move requests
void handleMove() {
  int horizontal = targetLR; // Default to current target if param missing
  int vertical = targetUD;   // Default to current target if param missing

  if (server.hasArg("h")) {
    horizontal = server.arg("h").toInt();
    horizontal = constrain(horizontal, limitsLR.minAngle, limitsLR.maxAngle);
    targetLR = horizontal;
  }
  if (server.hasArg("v")) {
    vertical = server.arg("v").toInt();
    vertical = constrain(vertical, limitsUD.minAngle, limitsUD.maxAngle);
    targetUD = vertical;
  }

  Serial.print("HTTP Move: H=");
  Serial.print(targetLR);
  Serial.print(", V=");
  Serial.println(targetUD);
  server.send(200, "text/plain", "OK - Moving eyes to H=" + String(targetLR) + ", V=" + String(targetUD));
}

// Handle /eyelids requests
void handleEyelids() {
  if (server.hasArg("openness")) {
    int openness = server.arg("openness").toInt();
    openness = constrain(openness, 0, 100);
    setEyelidsOpenness(openness);

    Serial.print("HTTP Eyelids: Openness=");
    Serial.println(openness);
    server.send(200, "text/plain", "OK - Setting eyelids to " + String(openness) + "%");
  } else {
    server.send(400, "text/plain", "Bad Request: Missing 'openness' parameter");
  }
}

// Handle /blink requests
void handleBlink() {
  blinking = true;
  blinkPhase = CLOSING;
  blinkStartTime = millis();
  closeEyes();

  Serial.println("HTTP Blink");
  server.send(200, "text/plain", "OK - Triggering blink");
}

// Handle /random requests
void handleRandom() {
  if (server.hasArg("enable")) {
    String enableStr = server.arg("enable");
    randomMovementEnabled = (enableStr == "1" || enableStr.equalsIgnoreCase("true"));

    Serial.print("HTTP Random Movement: ");
    Serial.println(randomMovementEnabled ? "Enabled" : "Disabled");
    server.send(200, "text/plain", "OK - Random movement " + String(randomMovementEnabled ? "enabled" : "disabled"));
  } else {
    server.send(400, "text/plain", "Bad Request: Missing 'enable' parameter");
  }
}

// Handle /autoblink requests
void handleAutoBlink() {
  if (server.hasArg("enable")) {
    String enableStr = server.arg("enable");
    autoBlinkingEnabled = (enableStr == "1" || enableStr.equalsIgnoreCase("true"));

    Serial.print("HTTP Auto Blinking: ");
    Serial.println(autoBlinkingEnabled ? "Enabled" : "Disabled");
    server.send(200, "text/plain", "OK - Auto blinking " + String(autoBlinkingEnabled ? "enabled" : "disabled"));
  } else {
    server.send(400, "text/plain", "Bad Request: Missing 'enable' parameter");
  }
}

// Handle Not Found requests
void handleNotFound() {
  server.send(404, "text/plain", "Not Found");
}

// --- Setup Function ---
void setup() {
  // Initialize serial communication for debugging
  Serial.begin(115200);
  Serial.println("\n\nSerial Initialized for Debugging.");

  // Initialize PCA9685
  Serial.println("Initializing PCA9685...");
  pwm.begin();
  Serial.println("PCA9685 Initialized.");
  pwm.setPWMFreq(50);  // 50 Hz update rate for servos
  Serial.println("PWM Frequency Set.");

  Serial.println("Seeding Random Generator...");
  randomSeed(analogRead(A0)); // Use an analog pin for better randomness if available
  Serial.println("Random Seed Set.");

  Serial.println("Calibrating Servos...");
  calibrate();
  Serial.println("Servos Calibrated.");
  // Start with centered positions
  currentLR = 90;
  currentUD = 90;
  targetLR = 90;
  targetUD = 90;

  // Schedule the first eye movement and blink events
  nextTargetTime = millis() + random(1000, 3000);  // New target every 1-3 seconds
  nextBlinkTime  = millis() + random(3000, 8000);   // Blink every 3-8 seconds

  // --- Connect to WiFi ---
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  // Set WiFi mode to station
  WiFi.mode(WIFI_STA);

  // Set supported WiFi protocols (802.11b/g/n)
  esp_err_t protocol_err = esp_wifi_set_protocol(WIFI_IF_STA, WIFI_PROTOCOL_11B | WIFI_PROTOCOL_11G | WIFI_PROTOCOL_11N);
  if (protocol_err == ESP_OK) {
    Serial.println("✅ WiFi protocol set to 11b/g/n.");
  } else {
    Serial.print("❌ Failed to set WiFi protocol. Error code: ");
    Serial.println(protocol_err);
  }

  WiFi.begin(ssid, password);
  int wifi_retries = 0;
  while (WiFi.status() != WL_CONNECTED && wifi_retries < 30) { // Retry for ~15 seconds
    delay(500);
    Serial.print(".");
    wifi_retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());

    // --- Setup HTTP Server Routes ---
    server.on("/", HTTP_GET, handleRoot);
    server.on("/move", HTTP_GET, handleMove);
    server.on("/eyelids", HTTP_GET, handleEyelids);
    server.on("/blink", HTTP_GET, handleBlink);
    server.on("/random", HTTP_GET, handleRandom);
    server.on("/autoblink", HTTP_GET, handleAutoBlink);
    server.onNotFound(handleNotFound);

    // Start the server
    server.begin();
    Serial.println("HTTP server started");
  } else {
    Serial.println("\nFailed to connect to WiFi. Check credentials.");
    // Optionally, enter a deep sleep or halt state here
  }
}

// --- Loop Function ---
void loop() {
  unsigned long currentMillis = millis();

  // Handle HTTP client requests if connected to WiFi
  if (WiFi.status() == WL_CONNECTED) {
    server.handleClient();
  }

  // --- Handle Blinking ---
  if (autoBlinkingEnabled && !blinking && currentMillis >= nextBlinkTime) { // Only check if auto-blinking is enabled
    blinking = true;
    blinkPhase = CLOSING;
    blinkStartTime = currentMillis;
    closeEyes();  // Begin blink by closing eyelids
  }

  if (blinking) {
    if (blinkPhase == CLOSING && (currentMillis - blinkStartTime >= blinkCloseDuration)) {
      blinkPhase = OPENING;
      blinkStartTime = currentMillis;
      // Reopen eyes to natural open state based on current UD position
      setEyesOpen(currentUD);
    } else if (blinkPhase == OPENING && (currentMillis - blinkStartTime >= blinkOpenDuration)) {
      blinking = false;
      blinkPhase = NONE;
      if (autoBlinkingEnabled) { // Only schedule next blink if auto-blinking is enabled
        nextBlinkTime = currentMillis + random(3000, 8000);  // Schedule next blink
      }
    }
  }

  // --- Update Eye Movement if Not Blinking ---
  if (!blinking) {
    // Choose a new random target position periodically if random movement is enabled
    if (randomMovementEnabled && currentMillis >= nextTargetTime) {
      targetLR = random(limitsLR.minAngle, limitsLR.maxAngle + 1);
      targetUD = random(limitsUD.minAngle, limitsUD.maxAngle + 1);
      nextTargetTime = currentMillis + random(1000, 3000);  // Next target in 1-3 sec
    }

    // Smoothly adjust current positions toward targets using a faster step
    currentLR = updateAngle(currentLR, targetLR);
    currentUD = updateAngle(currentUD, targetUD);

    // Update the eye position and ensure the eyelids remain open
    writeServo(SERVO_LR_CH, currentLR);
    setEyesOpen(currentUD);
  }

  delay(20);  // Small delay for smooth updates (~50 Hz refresh rate)
}