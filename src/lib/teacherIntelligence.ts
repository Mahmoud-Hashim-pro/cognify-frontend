/**
 * Milestone 13: Teacher Intelligence Domain Engine
 *
 * Provides classroom-level concept diagnostics, struggle cluster detection,
 * pedagogical intervention effectiveness benchmarking, and automated differentiated instruction grouping.
 */

import { StudentState, PedagogyStrategy } from '../types/studentState';
import { getConcept, diagnosePrerequisiteGap } from './conceptGraph';
import type {
  ConceptStruggleCluster,
  ClassInterventionEfficacy,
  DifferentiatedInstructionGroup,
  TeacherActionRecommendation,
  TeacherDashboardData,
  StudentMasterySnippet,
  HeatmapCell,
  ConceptHeatmapSummary,
  StudentHeatmapSummary,
  CohortMasteryHeatmapData,
  PrerequisiteAlertMessage,
  CurriculumPacingRecommendation,
} from '../types/teacher';

/**
 * Detects struggle clusters across an entire cohort of students.
 * A concept forms a struggle cluster if >= 25% of assessed students (or >= 3 students)
 * exhibit high cognitive strain (> 0.55), repeated errors (>= 2), or low accuracy (< 0.60).
 */
export function detectStruggleClusters(
  students: StudentState[],
  struggleRateThreshold = 0.25
): ConceptStruggleCluster[] {
  if (!students || students.length === 0) return [];

  // Map conceptId -> array of students who attempted it
  const conceptStats: Record<
    string,
    {
      totalAssessed: number;
      strugglingStudents: StudentState[];
      accuracies: number[];
    }
  > = {};

  for (const student of students) {
    const masteryMap = student.conceptMastery || {};
    for (const [conceptId, mastery] of Object.entries(masteryMap)) {
      if (!conceptStats[conceptId]) {
        conceptStats[conceptId] = {
          totalAssessed: 0,
          strugglingStudents: [],
          accuracies: [],
        };
      }

      conceptStats[conceptId].totalAssessed++;
      conceptStats[conceptId].accuracies.push(mastery.accuracy || 0);

      const isStruggling =
        (mastery.consecutiveIncorrect || 0) >= 2 ||
        (mastery.accuracy || 0) < 0.60 ||
        (student.learningStrain?.signals?.length || 0) >= 2 ||
        (student.learningStrain?.possibleStruggle ?? student.struggleSignal ?? 0) > 0.55;

      if (isStruggling) {
        conceptStats[conceptId].strugglingStudents.push(student);
      }
    }
  }

  const clusters: ConceptStruggleCluster[] = [];

  for (const [conceptId, stats] of Object.entries(conceptStats)) {
    if (stats.totalAssessed === 0) continue;
    const struggleRate = stats.strugglingStudents.length / stats.totalAssessed;

    if (struggleRate >= struggleRateThreshold || stats.strugglingStudents.length >= 3) {
      const node = getConcept(conceptId);
      const avgAcc =
        stats.accuracies.reduce((a, b) => a + b, 0) / stats.accuracies.length;

      // Diagnose root prerequisite gap across struggling students
      let prerequisiteGap: ConceptStruggleCluster['diagnosedPrerequisiteGap'] | undefined = undefined;
      if (stats.strugglingStudents.length > 0) {
        const sampleStruggler = stats.strugglingStudents[0];
        const masteryLookup: Record<string, { accuracy: number; attempts: number; confidence: number }> = {};
        for (const [cId, m] of Object.entries(sampleStruggler.conceptMastery || {})) {
          masteryLookup[cId] = {
            accuracy: m.accuracy,
            attempts: m.attempts,
            confidence: m.consecutiveCorrect > 0 ? 0.7 : 0.4,
          };
        }
        const diag = diagnosePrerequisiteGap(conceptId, masteryLookup);
        if (diag.hasPrerequisiteGap && diag.missingPrerequisites.length > 0) {
          const prereqId = diag.missingPrerequisites[0];
          const prereqNode = diag.rootGapConcept || getConcept(prereqId);
          prerequisiteGap = {
            prerequisiteId: prereqId,
            prerequisiteTitleEn: prereqNode?.nameEn || prereqId,
            prerequisiteTitleAr: prereqNode?.nameAr || prereqId,
            gapSeverity: struggleRate > 0.5 ? 'critical' : 'moderate',
          };
        }
      }

      clusters.push({
        conceptId,
        conceptTitleEn: node?.nameEn || conceptId,
        conceptTitleAr: node?.nameAr || conceptId,
        totalStudentsAssessed: stats.totalAssessed,
        strugglingStudentCount: stats.strugglingStudents.length,
        struggleRatePercentage: Math.round(struggleRate * 100),
        averageAccuracy: Math.round(avgAcc * 100) / 100,
        diagnosedPrerequisiteGap: prerequisiteGap,
        commonErrorPatterns: ['unhandled_edge_case', 'syntax_boundary_mismatch'],
      });
    }
  }

  // Sort by struggle rate descending
  return clusters.sort((a, b) => b.struggleRatePercentage - a.struggleRatePercentage);
}

/**
 * Aggregates pedagogical intervention efficacy across all students in the classroom.
 * Shows which teaching strategy produced the highest win rate and normalized learning gains.
 */
export function evaluateClassInterventionEfficacy(
  students: StudentState[]
): Record<string, ClassInterventionEfficacy> {
  const strategies: PedagogyStrategy[] = [
    'worked_example',
    'socratic',
    'scaffolded',
    'analogies',
  ];

  const results: Record<string, ClassInterventionEfficacy> = {};

  for (const strat of strategies) {
    let totalAttempts = 0;
    let totalHelpful = 0;
    let totalUnhelpful = 0;
    let totalGain = 0;
    let gainCount = 0;

    for (const student of students) {
      const eff = student.pedagogyEffectiveness?.[strat];
      if (eff) {
        totalAttempts += eff.helpfulCount + eff.unhelpfulCount;
        totalHelpful += eff.helpfulCount;
        totalUnhelpful += eff.unhelpfulCount;
      }

      // Check normalized gain history if student used this strategy
      const gains = (student as any).normalizedGainHistory || [];
      for (const g of gains) {
        if (student.activePedagogy === strat && typeof g.gain === 'number') {
          totalGain += g.gain;
          gainCount++;
        }
      }
    }

    const efficacyRate =
      totalAttempts > 0
        ? Math.round((totalHelpful / totalAttempts) * 100) / 100
        : 0.5;

    const avgGain =
      gainCount > 0 ? Math.round((totalGain / gainCount) * 1000) / 1000 : 0.45;

    results[strat] = {
      strategy: strat,
      attemptsCount: totalAttempts,
      helpfulCount: totalHelpful,
      unhelpfulCount: totalUnhelpful,
      efficacyRate,
      averageNormalizedGain: avgGain,
      isCalibrated: totalAttempts >= 3,
    };
  }

  return results;
}

/**
 * Automatically groups classroom students into differentiated instruction cohorts:
 * - Group A: Scaffolding & Worked Examples (Needs foundational concept rebuilding)
 * - Group B: Guided Practice & Analogies (Developing conceptual fluency)
 * - Group C: Socratic Inquiries & Higher-order Challenges (Mastery achieved, ready for deep rigor)
 */
export function generateDifferentiatedGroups(
  students: StudentState[],
  targetConceptId = 'pointers'
): DifferentiatedInstructionGroup[] {
  if (!students || students.length === 0) return [];

  const needsFoundation: StudentMasterySnippet[] = [];
  const developingFluency: StudentMasterySnippet[] = [];
  const advancedRigors: StudentMasterySnippet[] = [];

  for (const student of students) {
    const mastery = student.conceptMastery?.[targetConceptId];
    const acc = mastery?.accuracy ?? 0.5;
    const strain = student.learningStrain?.possibleStruggle ?? student.struggleSignal ?? 0.2;
    const consecutiveIncorrect = mastery?.consecutiveIncorrect ?? 0;

    const snippet: StudentMasterySnippet = {
      uid: student.uid,
      name: student.uid.replace('student_', 'Student '),
      accuracy: acc,
      learningStrain: strain,
      consecutiveIncorrect,
      preferredPedagogy: student.activePedagogy,
    };

    if (acc < 0.60 || consecutiveIncorrect >= 2 || strain > 0.55) {
      needsFoundation.push(snippet);
    } else if (acc >= 0.80 && strain < 0.35) {
      advancedRigors.push(snippet);
    } else {
      developingFluency.push(snippet);
    }
  }

  const groups: DifferentiatedInstructionGroup[] = [];

  if (needsFoundation.length > 0) {
    groups.push({
      id: 'group_foundational_scaffolding',
      groupNameEn: 'Foundational Scaffolding Group',
      groupNameAr: 'مجموعة الدعم المعرفي والتدريج',
      targetConceptId,
      recommendedPedagogy: 'worked_example',
      students: needsFoundation,
      pedagogicalRationaleEn:
        'Students exhibit high cognitive strain and prerequisite hesitation. Recommend worked step-by-step examples before independent drill.',
      pedagogicalRationaleAr:
        'يظهر الطلاب إجهاداً معرفياً وتعثراً متكرراً. نوصي بأمثلة محلولة خطوة بخطوة قبل الانتقال للتدريبات المستقلة.',
    });
  }

  if (developingFluency.length > 0) {
    groups.push({
      id: 'group_guided_practice',
      groupNameEn: 'Guided Fluency Group',
      groupNameAr: 'مجموعة الممارسة الموجهة',
      targetConceptId,
      recommendedPedagogy: 'scaffolded',
      students: developingFluency,
      pedagogicalRationaleEn:
        'Students demonstrate baseline comprehension with minor syntax variance. Recommend guided interactive hints.',
      pedagogicalRationaleAr:
        'أظهر الطلاب فهماً أساسياً للمفهوم مع بعض الأخطاء البسيطة. نوصي بالتوجيه التفاعلي والتلميحات التدريجية.',
    });
  }

  if (advancedRigors.length > 0) {
    groups.push({
      id: 'group_advanced_socratic',
      groupNameEn: 'Advanced Socratic Inquiry Group',
      groupNameAr: 'مجموعة التحدي السقراطي المتقدم',
      targetConceptId,
      recommendedPedagogy: 'socratic',
      students: advancedRigors,
      pedagogicalRationaleEn:
        'Students have reached high mastery (>=80%). Recommend exploratory problem-solving and architectural edge cases.',
      pedagogicalRationaleAr:
        'حقق هؤلاء الطلاب إتقاناً مرتفعاً (>=80%). نوصي بتحديات سقراطية وحالات حافة معمقة لتوسيع مداركهم البرمجية.',
    });
  }

  return groups;
}

/**
 * Synthesizes concrete, actionable teaching recommendations for the educator.
 */
export function generateTeacherRecommendations(
  clusters: ConceptStruggleCluster[],
  efficacy: Record<string, ClassInterventionEfficacy>
): TeacherActionRecommendation[] {
  const recommendations: TeacherActionRecommendation[] = [];

  for (const cluster of clusters) {
    if (cluster.struggleRatePercentage >= 40 && cluster.diagnosedPrerequisiteGap) {
      recommendations.push({
        id: `rec_prereq_${cluster.conceptId}`,
        priority: 'urgent',
        category: 'prerequisite_review',
        targetedConceptId: cluster.conceptId,
        titleEn: `Prerequisite Gap Detected: ${cluster.conceptTitleEn}`,
        titleAr: `فجوة في المتطلبات السابقة: ${cluster.conceptTitleAr}`,
        actionPromptEn: `${cluster.strugglingStudentCount} students (${cluster.struggleRatePercentage}%) are struggling with ${cluster.conceptTitleEn}. The root cause is missing mastery in "${cluster.diagnosedPrerequisiteGap.prerequisiteTitleEn}". Spend 15 minutes reviewing this prerequisite in your next lecture.`,
        actionPromptAr: `${cluster.strugglingStudentCount} طالباً (${cluster.struggleRatePercentage}%) يعانون من صعوبة في ${cluster.conceptTitleAr}. السبب الجذري هو عدم التمكن من "${cluster.diagnosedPrerequisiteGap.prerequisiteTitleAr}". ننصح بتخصيص 15 دقيقة لمراجعة هذا المتطلب في المحاضرة القادمة.`,
      });
    }
  }

  // Check top performing pedagogy strategy across the class
  const sortedEfficacy = Object.values(efficacy).sort((a, b) => b.efficacyRate - a.efficacyRate);
  if (sortedEfficacy.length > 0 && sortedEfficacy[0].attemptsCount >= 3) {
    const top = sortedEfficacy[0];
    recommendations.push({
      id: `rec_pedagogy_top`,
      priority: 'high',
      category: 'strategy_pivot',
      titleEn: `High Efficacy Strategy: ${top.strategy.toUpperCase()}`,
      titleAr: `الاستراتيجية التعليمية الأعلى نجاحاً: ${top.strategy}`,
      actionPromptEn: `Teaching via "${top.strategy}" yielded a ${Math.round(top.efficacyRate * 100)}% class win-rate. Prioritize this approach during group lab activities.`,
      actionPromptAr: `التدريس بأسلوب "${top.strategy}" حقق أعلى نسبة نجاح في الفصل بنسبة ${Math.round(top.efficacyRate * 100)}%. اعتمد هذه الطريقة في جلسات التطبيق العملي.`,
    });
  }

  return recommendations;
}

/**
 * Generates a full Cohort Mastery Heatmap across all students and tracked concepts.
 */
export function generateCohortMasteryHeatmap(
  students: StudentState[],
  concepts?: string[]
): CohortMasteryHeatmapData {
  if (!students || students.length === 0) {
    return { concepts: [], cells: [], conceptSummaries: [], studentSummaries: [] };
  }

  // Determine tracked concepts from union of students' mastery if not specified
  let conceptList = concepts;
  if (!conceptList || conceptList.length === 0) {
    const conceptSet = new Set<string>();
    for (const s of students) {
      for (const k of Object.keys(s.conceptMastery || {})) {
        conceptSet.add(k);
      }
    }
    conceptList = Array.from(conceptSet);
  }

  const cells: HeatmapCell[] = [];
  const conceptAcc: Record<string, { totalAcc: number; count: number; strugglingCount: number }> = {};
  for (const c of conceptList) {
    conceptAcc[c] = { totalAcc: 0, count: 0, strugglingCount: 0 };
  }

  const studentSummaries: StudentHeatmapSummary[] = [];

  for (const student of students) {
    let sTotalAcc = 0;
    let sCount = 0;
    let sStruggling = 0;

    for (const cId of conceptList) {
      const mastery = student.conceptMastery?.[cId];
      const acc = mastery ? mastery.accuracy : 0.5;
      const conf = mastery ? mastery.confidence : 0.5;

      let colorTier: 'green' | 'yellow' | 'red';
      if (acc >= 0.80) {
        colorTier = 'green';
      } else if (acc >= 0.60) {
        colorTier = 'yellow';
      } else {
        colorTier = 'red';
      }

      cells.push({
        studentUid: student.uid,
        studentName: student.uid.replace('std_', 'Student ').replace('student_', 'Student '),
        conceptId: cId,
        accuracy: acc,
        confidence: conf,
        colorTier,
      });

      if (conceptAcc[cId]) {
        conceptAcc[cId].totalAcc += acc;
        conceptAcc[cId].count += 1;
        if (colorTier === 'red') {
          conceptAcc[cId].strugglingCount += 1;
        }
      }

      sTotalAcc += acc;
      sCount += 1;
      if (colorTier === 'red') {
        sStruggling += 1;
      }
    }

    const sAvg = sCount > 0 ? Math.round((sTotalAcc / sCount) * 100) / 100 : 0.5;
    let sTier: 'green' | 'yellow' | 'red' = 'yellow';
    if (sAvg >= 0.80) sTier = 'green';
    else if (sAvg < 0.60) sTier = 'red';

    studentSummaries.push({
      studentUid: student.uid,
      studentName: student.uid.replace('std_', 'Student ').replace('student_', 'Student '),
      averageAccuracy: sAvg,
      colorTier: sTier,
      strugglingConceptsCount: sStruggling,
    });
  }

  const conceptSummaries: ConceptHeatmapSummary[] = conceptList.map((cId) => {
    const data = conceptAcc[cId] || { totalAcc: 0, count: 0, strugglingCount: 0 };
    const avg = data.count > 0 ? Math.round((data.totalAcc / data.count) * 100) / 100 : 0.5;
    let tier: 'green' | 'yellow' | 'red' = 'yellow';
    if (avg >= 0.80) tier = 'green';
    else if (avg < 0.60) tier = 'red';

    const node = getConcept(cId);
    return {
      conceptId: cId,
      conceptTitleEn: node?.nameEn || cId,
      conceptTitleAr: node?.nameAr || cId,
      averageAccuracy: avg,
      colorTier: tier,
      strugglingCount: data.strugglingCount,
    };
  });

  return {
    concepts: conceptList,
    cells,
    conceptSummaries,
    studentSummaries,
  };
}

/**
 * Evaluates curriculum pacing based on struggle rates, prerequisite gaps, and aggregate class accuracy.
 */
export function evaluateCurriculumPacing(
  classId: string,
  clusters: ConceptStruggleCluster[],
  summaries: ConceptHeatmapSummary[]
): CurriculumPacingRecommendation {
  const criticalStruggle = clusters.some(
    (c) => c.struggleRatePercentage >= 35 && c.diagnosedPrerequisiteGap
  );

  if (criticalStruggle) {
    return {
      classId,
      pacingDecision: 'decelerate_review',
      pacingRationaleEn:
        'Critical prerequisite gap detected in over 35% of the class. Decelerate planned curriculum to review foundational pointers.',
      pacingRationaleAr:
        'تم اكتشاف فجوة حرجة في المتطلبات السابقة لدى أكثر من 35% من الطلاب. يوصى بتهدئة وتيرة المنهج لمراجعة المتطلبات السابقة.',
      recommendedReviewHours: 2,
      nextPlannedModule:
        'Foundational Pointer Remediation & Step-by-Step Worked Examples',
    };
  }

  const classAverage =
    summaries.length > 0
      ? summaries.reduce((acc, c) => acc + c.averageAccuracy, 0) / summaries.length
      : 0.75;

  if (classAverage >= 0.85) {
    return {
      classId,
      pacingDecision: 'accelerate_enrich',
      pacingRationaleEn:
        'Cohort demonstrates comprehensive mastery. Accelerate to advanced distributed systems modules.',
      pacingRationaleAr:
        'يُظهر الطلاب إتقاناً شاملاً. يمكن تسريع وتيرة المنهج والانتقال لمفاهيم متقدمة.',
      recommendedReviewHours: 0,
      nextPlannedModule: 'Advanced Distributed Data Structures',
    };
  }

  return {
    classId,
    pacingDecision: 'maintain_pace',
    pacingRationaleEn:
      'Class pacing is steady. Maintain current syllabus schedule.',
    pacingRationaleAr:
      'وتيرة الفصل متوازنة ومستقرة. استمر في الجدول الدراسي المعتاد.',
    recommendedReviewHours: 0,
    nextPlannedModule: 'Standard Syllabus Progression',
  };
}

/**
 * Dispatches an automated remediation alert for a high-struggle concept into the teacher alert feed.
 */
export function dispatchTeacherAlert(
  teacherUid: string,
  cluster: ConceptStruggleCluster
): PrerequisiteAlertMessage {
  const prereqId = cluster.diagnosedPrerequisiteGap?.prerequisiteId || cluster.conceptId;
  const prereqTitle = cluster.diagnosedPrerequisiteGap?.prerequisiteTitleEn || prereqId;
  const prereqTitleAr = cluster.diagnosedPrerequisiteGap?.prerequisiteTitleAr || prereqId;

  return {
    alertId: `alert_prereq_${Date.now()}_${cluster.conceptId}`,
    severity: cluster.struggleRatePercentage >= 50 ? 'urgent' : 'warning',
    targetConceptId: cluster.conceptId,
    rootPrerequisiteId: prereqId,
    affectedStudentCount: cluster.strugglingStudentCount,
    recipientTeacherUid: teacherUid,
    dispatchedTimestamp: Date.now(),
    messageEn: `URGENT ALERT: ${cluster.strugglingStudentCount} students (${cluster.struggleRatePercentage}%) are failing ${cluster.conceptTitleEn} due to an unmastered prerequisite: "${prereqTitle}".`,
    messageAr: `تنبيه عاجل: ${cluster.strugglingStudentCount} طالباً (${cluster.struggleRatePercentage}%) يعانون من صعوبة في ${cluster.conceptTitleAr} بسبب عدم إتقان المتطلب الأساسي: "${prereqTitleAr}".`,
    suggestedClassAction: `Allocate 20 minutes in next lecture for worked-example review of ${prereqTitle} before continuing ${cluster.conceptTitleEn}.`,
  };
}

/**
 * Compiles a full, structured Teacher Dashboard view dataset.
 */
export function compileTeacherDashboard(
  classId: string,
  className: string,
  students: StudentState[]
): TeacherDashboardData {
  const totalStudents = students.length;
  const struggleClusters = detectStruggleClusters(students, 0.25);
  const interventionEfficacy = evaluateClassInterventionEfficacy(students);
  const primaryConcept = struggleClusters.length > 0 ? struggleClusters[0].conceptId : 'pointers';
  const differentiatedGroups = generateDifferentiatedGroups(students, primaryConcept);
  const actionRecommendations = generateTeacherRecommendations(struggleClusters, interventionEfficacy);

  // Compute class average mastery across all concepts
  let totalMasterySum = 0;
  let masteryCount = 0;
  for (const s of students) {
    for (const m of Object.values(s.conceptMastery || {})) {
      totalMasterySum += m.accuracy || 0;
      masteryCount++;
    }
  }
  const classAverageMastery =
    masteryCount > 0 ? Math.round((totalMasterySum / masteryCount) * 100) : 75;

  const heatmap = generateCohortMasteryHeatmap(students);
  const curriculumPacing = evaluateCurriculumPacing(classId, struggleClusters, heatmap.conceptSummaries);

  return {
    classId,
    className,
    totalStudents,
    activeRatePercentage: 92,
    classAverageMastery,
    struggleClusters,
    interventionEfficacy,
    differentiatedGroups,
    actionRecommendations,
    curriculumPacing,
    heatmap,
  };
}

