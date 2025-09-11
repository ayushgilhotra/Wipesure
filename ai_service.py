from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import random
import time
import json

app = Flask(__name__)
CORS(app)

class ResidueAnalyzer:
    def __init__(self):
        self.entropy_threshold = 99.5
        
    def calculate_entropy(self, device_id):
        """Simulate entropy calculation for device storage"""
        # Simulate random entropy score between 95-100 for demonstration
        base_entropy = random.uniform(95.0, 100.0)
        
        # Add some device-specific variation
        device_factor = hash(device_id) % 100 / 100.0
        entropy = min(100.0, base_entropy + device_factor)
        
        return round(entropy, 2)
    
    def detect_recoverable_files(self, entropy_score):
        """Determine number of potentially recoverable files based on entropy"""
        if entropy_score >= 99.8:
            return 0
        elif entropy_score >= 99.0:
            return random.randint(0, 2)
        elif entropy_score >= 95.0:
            return random.randint(2, 10)
        else:
            return random.randint(10, 50)
    
    def determine_residue_status(self, entropy_score, recoverable_files):
        """Determine overall residue status"""
        if entropy_score >= 99.8 and recoverable_files == 0:
            return "CLEAN"
        elif entropy_score >= 99.0 and recoverable_files <= 2:
            return "MOSTLY_CLEAN"
        elif entropy_score >= 95.0:
            return "SOME_RESIDUE"
        else:
            return "HIGH_RESIDUE"
    
    def analyze_device(self, job_id, device_id):
        """Perform comprehensive residue analysis"""
        # Simulate analysis time
        time.sleep(random.uniform(2, 5))
        
        # Calculate metrics
        entropy_score = self.calculate_entropy(device_id)
        recoverable_files = self.detect_recoverable_files(entropy_score)
        residue_status = self.determine_residue_status(entropy_score, recoverable_files)
        
        # Generate detailed analysis
        analysis_details = {
            "sectors_analyzed": random.randint(1000000, 5000000),
            "data_patterns_found": random.randint(0, 100),
            "encryption_residue": random.choice([True, False]),
            "metadata_traces": random.randint(0, 50),
            "file_signature_remnants": random.randint(0, 20)
        }
        
        return {
            "job_id": job_id,
            "device_id": device_id,
            "entropy_score": entropy_score,
            "recoverable_files": recoverable_files,
            "residue_status": residue_status,
            "analysis_details": analysis_details,
            "timestamp": time.time(),
            "confidence_level": random.uniform(95.0, 99.9)
        }

analyzer = ResidueAnalyzer()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "WipeSure AI Residue Analyzer",
        "version": "1.0.0"
    })

@app.route('/analyze', methods=['POST'])
def analyze_residue():
    """Main analysis endpoint"""
    try:
        data = request.get_json()
        job_id = data.get('job_id')
        device_id = data.get('device_id')
        
        if not job_id or not device_id:
            return jsonify({
                "error": "Missing required parameters: job_id and device_id"
            }), 400
        
        # Perform analysis
        result = analyzer.analyze_device(job_id, device_id)
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({
            "error": f"Analysis failed: {str(e)}",
            "entropy_score": 0.0,
            "recoverable_files": 999,
            "residue_status": "ERROR"
        }), 500

@app.route('/quick-scan', methods=['POST'])
def quick_scan():
    """Quick scan endpoint for real-time UI updates"""
    try:
        data = request.get_json()
        device_id = data.get('device_id', 'unknown')
        
        # Quick scan simulation
        entropy = analyzer.calculate_entropy(device_id)
        recoverable = analyzer.detect_recoverable_files(entropy)
        status = analyzer.determine_residue_status(entropy, recoverable)
        
        return jsonify({
            "entropy_score": entropy,
            "recoverable_files": recoverable,
            "residue_status": status,
            "scan_progress": 100,
            "estimated_time": 0
        })
    
    except Exception as e:
        return jsonify({
            "error": f"Quick scan failed: {str(e)}"
        }), 500

@app.route('/simulation/patterns', methods=['GET'])
def get_data_patterns():
    """Generate simulated data patterns for visualization"""
    patterns = []
    
    # Generate random data patterns for radar visualization
    for i in range(360):  # 360 degrees
        angle = i
        distance = random.uniform(0.1, 1.0)
        intensity = random.uniform(0, 100)
        
        patterns.append({
            "angle": angle,
            "distance": distance,
            "intensity": intensity,
            "pattern_type": random.choice(["deleted_file", "metadata", "free_space", "encrypted"])
        })
    
    return jsonify({
        "patterns": patterns,
        "scan_radius": 1.0,
        "total_points": len(patterns)
    })

if __name__ == '__main__':
    print("WipeSure AI Residue Analyzer starting...")
    print("Service available at: http://localhost:8000")
    app.run(host='0.0.0.0', port=8000, debug=True)