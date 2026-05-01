'use client';

import { useState } from 'react';
import styles from '../app/LandingPage.module.css';

export default function ROICalculator() {
  const [consultations, setConsultations] = useState(50);
  const [avgRxValue, setAvgRxValue] = useState(800);
  const [captureRate, setCaptureRate] = useState(35);

  const monthlyRevenue = consultations * 30 * avgRxValue;
  const currentCapture = monthlyRevenue * (captureRate / 100);
  const targetCapture = monthlyRevenue * 0.75; // Kloqo targets 75%+
  const recoverable = targetCapture - currentCapture;

  return (
    <div className={styles.calculatorGrid}>
      <div className={styles.calculatorInputs}>
        <div className={styles.sliderGroup}>
          <div className={styles.sliderHeader}>
            <span className={styles.sliderLabel}>Avg. Daily Consultations</span>
            <span className={styles.sliderValue}>{consultations}</span>
          </div>
          <input 
            type="range" 
            min="10" max="200" step="5"
            value={consultations} 
            onChange={(e) => setConsultations(Number(e.target.value))}
            className={styles.rangeInput}
          />
        </div>

        <div className={styles.sliderGroup}>
          <div className={styles.sliderHeader}>
            <span className={styles.sliderLabel}>Avg. Prescription Value (₹)</span>
            <span className={styles.sliderValue}>₹{avgRxValue}</span>
          </div>
          <input 
            type="range" 
            min="200" max="3000" step="50"
            value={avgRxValue} 
            onChange={(e) => setAvgRxValue(Number(e.target.value))}
            className={styles.rangeInput}
          />
        </div>

        <div className={styles.sliderGroup}>
          <div className={styles.sliderHeader}>
            <span className={styles.sliderLabel}>Current Pharmacy Capture (%)</span>
            <span className={styles.sliderValue}>{captureRate}%</span>
          </div>
          <input 
            type="range" 
            min="10" max="100" step="1"
            value={captureRate} 
            onChange={(e) => setCaptureRate(Number(e.target.value))}
            className={styles.rangeInput}
          />
        </div>
      </div>

      <div className={styles.resultCard}>
        <span className={styles.resultLabel}>Recoverable Monthly Revenue</span>
        <div className={styles.resultValue}>₹{Math.round(recoverable).toLocaleString()}</div>
        <p className={styles.resultSub}>Based on Kloqo's average 75% fulfillment lift</p>
      </div>
    </div>
  );
}
