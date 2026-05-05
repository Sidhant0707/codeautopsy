

export interface CodebaseMetrics {
  totalFiles: number;
  circularDependencies: number; 
  maxFanIn: number;             
  largeFilesCount: number;      
}

export function calculateHealthGrade(metrics: CodebaseMetrics) {
  let score = 100;

  
  
  score -= (metrics.circularDependencies * 15);

  
  
  const SAFE_FAN_IN_THRESHOLD = 10;
  if (metrics.maxFanIn > SAFE_FAN_IN_THRESHOLD) {
    
    const couplingPenalty = Math.min(30, (metrics.maxFanIn - SAFE_FAN_IN_THRESHOLD) * 2);
    score -= couplingPenalty;
  }

  
  
  const largeFileRatio = metrics.largeFilesCount / Math.max(1, metrics.totalFiles);
  score -= (largeFileRatio * 40); 

  
  score = Math.max(0, Math.min(100, Math.round(score)));

  
  let grade = "F";
  let color = "red-500";
  let status = "Critical Tech Debt";

  if (score >= 90) { 
    grade = "A"; 
    color = "emerald-500"; 
    status = "Pristine Architecture";
  } else if (score >= 80) { 
    grade = "B"; 
    color = "blue-500"; 
    status = "Solid Foundation";
  } else if (score >= 70) { 
    grade = "C"; 
    color = "amber-500"; 
    status = "Moderate Coupling";
  } else if (score >= 60) { 
    grade = "D"; 
    color = "orange-500"; 
    status = "High Refactor Risk";
  }

  return { score, grade, color, status };
}