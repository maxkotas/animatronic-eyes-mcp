// Modified Arduino code for animatronic eyes with MCP server control
// This code extends the original random movement code with serial command support

#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>

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

// --- MCP Control Variables ---
bool randomMovementEnabled = false; // Disable random movement by default
String inputBuffer = "";            // Buffer for incoming serial data
bool stringComplete = false;        // Flag for complete command received

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

// --- Process MCP Commands ---
void processCommand(String command) {
  // Trim any whitespace
  command.trim();
  
  // Log received command
  Serial.print("Received command: ");
  Serial.println(command);
  
  if (command.startsWith("MOVE ")) {
    // Extract horizontal and vertical values
    int spaceIndex = command.indexOf(' ', 5);
    if (spaceIndex > 5) {
      int horizontal = command.substring(5, spaceIndex).toInt();
      int vertical = command.substring(spaceIndex + 1).toInt();
      
      // Constrain values to valid ranges
      horizontal = constrain(horizontal, limitsLR.minAngle, limitsLR.maxAngle);
      vertical = constrain(vertical, limitsUD.minAngle, limitsUD.maxAngle);
      
      // Set target positions
      targetLR = horizontal;
      targetUD = vertical;
      
      Serial.print("Moving eyes to: H=");
      Serial.print(horizontal);
      Serial.print(", V=");
      Serial.println(vertical);
    }
  }
  else if (command.startsWith("EYELIDS ")) {
    // Extract openness value (0-100%)
    int openness = command.substring(8).toInt();
    openness = constrain(openness, 0, 100);
    
    // Directly set eyelid positions based on percentage
    setEyelidsOpenness(openness);
    
    Serial.print("Setting eyelids to ");
    Serial.print(openness);
    Serial.println("% open");
  }
  else if (command == "BLINK") {
    // Trigger blink
    blinking = true;
    blinkPhase = CLOSING;
    blinkStartTime = millis();
    closeEyes();
    
    Serial.println("Blinking eyes");
  }
  else if (command.startsWith("RANDOM ")) {
    // Extract enable value (0/1)
    String enableStr = command.substring(7);
    randomMovementEnabled = (enableStr == "1" || enableStr.equalsIgnoreCase("true"));
    
    Serial.print("Random movement ");
    Serial.println(randomMovementEnabled ? "enabled" : "disabled");
  }
  else {
    Serial.print("Unknown command: ");
    Serial.println(command);
  }
}

void setup() {
  // Initialize serial communication
  Serial.begin(115200);
  // Removed while(!Serial);
  Serial.println("Serial Initialized.");
  inputBuffer.reserve(50);  // Reserve space for incoming commands
  
  // Initialize PCA9685
  Serial.println("Initializing PCA9685...");
  pwm.begin();
  Serial.println("PCA9685 Initialized.");
  pwm.setPWMFreq(50);  // 50 Hz update rate for servos
  Serial.println("PWM Frequency Set.");
  Serial.println("Seeding Random Generator...");
  randomSeed(analogRead(0)); // Seed random number generator
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
  nextBlinkTime  = millis() + random(3000, 8000);  // Blink every 3-8 seconds
  
  // Add a delay before sending Ready message to allow host to connect
  Serial.println("Waiting before sending Ready...");
  delay(1000); // Wait 1 second
  
  // Send ready message
  Serial.println("Animatronic Eyes Ready");
}

void loop() {
  unsigned long currentMillis = millis();
  
  // --- Check for Serial Commands ---
  while (Serial.available()) {
    char inChar = (char)Serial.read();
    
    // Add character to buffer if not end of line
    if (inChar != '\n') {
      inputBuffer += inChar;
    } else {
      // End of line reached, process command
      stringComplete = true;
    }
  }
  
  // Process complete command
  if (stringComplete) {
    processCommand(inputBuffer);
    inputBuffer = "";
    stringComplete = false;
  }
  
  // --- Handle Blinking ---
  if (!blinking && currentMillis >= nextBlinkTime) {
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
      // nextBlinkTime = currentMillis + random(3000, 8000);  // Schedule next blink (COMMENTED OUT TO DISABLE AUTO-BLINK)
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
