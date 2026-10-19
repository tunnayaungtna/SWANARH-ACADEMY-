import React, { useState } from 'react';
import {
  Course,
  Assignment,
  AssignmentSubmission,
  Quiz,
  QuizSubmission,
  User,
  StudentProgress,
  CertificateData,
} from '../types/classroom';
import { ClassroomDB } from '../services/storage';
import { useBackHandler } from '../utils/backNavigation';
import {
  FileText,
  HelpCircle,
  CheckCircle2,
  Clock,
  Upload,
  Award,
  ChevronRight,
  AlertCircle,
  ExternalLink,
  BookOpen,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface ClassworkViewProps {
  course: Course;
  currentUser: User;
  assignments: Assignment[];
  quizzes: Quiz[];
  progress: StudentProgress;
  onRefresh: () => void;
  onOpenCertificate: (cert: CertificateData) => void;
}

export const ClassworkView: React.FC<ClassworkViewProps> = ({
  course,
  currentUser,
  assignments,
  quizzes,
  progress,
  onRefresh,
  onOpenCertificate,
}) => {
  // Submission dialog state for students
  const [activeAssignmentForSubmit, setActiveAssignmentForSubmit] = useState<Assignment | null>(null);
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [submissionFileName, setSubmissionFileName] = useState('');
  const [submissionComment, setSubmissionComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Admin grading dialog state
  const [activeAssignmentForGrading, setActiveAssignmentForGrading] = useState<Assignment | null>(null);
  const [selectedSubmissionToGrade, setSelectedSubmissionToGrade] = useState<AssignmentSubmission | null>(null);
  const [gradeInput, setGradeInput] = useState<number>(95);
  const [feedbackInput, setFeedbackInput] = useState<string>('Great technical execution.');

  // Interactive MCQ Quiz Runner State
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [quizSubmittedResult, setQuizSubmittedResult] = useState<{
    submission: QuizSubmission;
    passed: boolean;
    score: number;
  } | null>(null);

  // Step-by-step mobile Back button handlers for Classwork dialogs & Quiz Runner
  useBackHandler(!!activeAssignmentForSubmit, () => setActiveAssignmentForSubmit(null));
  useBackHandler(!!activeAssignmentForGrading, () => setActiveAssignmentForGrading(null));
  useBackHandler(!!selectedSubmissionToGrade, () => setSelectedSubmissionToGrade(null));
  useBackHandler(!!activeQuiz, () => setActiveQuiz(null));

  // Calculate overall course progress percentage
  const totalItems = (course.totalLessons || 1) + assignments.length + quizzes.length;
  const completedItems =
    progress.completedLessonIds.length +
    progress.completedAssignmentIds.length +
    progress.passedQuizIds.length;
  const progressPct = Math.min(100, Math.round((completedItems / totalItems) * 100));

  const handleStudentSubmitHomework = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAssignmentForSubmit) return;

    setIsSubmitting(true);
    ClassroomDB.submitAssignment(
      activeAssignmentForSubmit.id,
      course.id,
      submissionComment,
      submissionFileName || `${currentUser.username}_${activeAssignmentForSubmit.title.replace(/\s+/g, '_')}.pdf`,
      currentUser
    );

    setTimeout(() => {
      setIsSubmitting(false);
      setActiveAssignmentForSubmit(null);
      setSubmissionFile(null);
      setSubmissionFileName('');
      setSubmissionComment('');
      onRefresh();
    }, 400);
  };

  const handleAdminGradeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubmissionToGrade) return;

    ClassroomDB.gradeAssignment(selectedSubmissionToGrade.id, gradeInput, feedbackInput);
    setSelectedSubmissionToGrade(null);
    onRefresh();
  };

  const handleStartQuiz = (quiz: Quiz) => {
    setActiveQuiz(quiz);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setQuizSubmittedResult(null);
  };

  const handleSelectQuizOption = (questionId: string, optionIndex: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmitQuiz = () => {
    if (!activeQuiz) return;
    const result = ClassroomDB.submitQuiz(activeQuiz, selectedAnswers, currentUser);
    setQuizSubmittedResult(result);
    onRefresh();
  };

  const handleClaimCertificate = () => {
    const cert = ClassroomDB.issueCertificate(currentUser, course);
    onRefresh();
    onOpenCertificate(cert);
  };

  return (
    <div className="space-y-8">
      {/* Student Progress Overview & Certificate Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-850">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Course Progress & Completion
              </span>
              <span className="text-xs font-mono font-medium text-indigo-600 dark:text-indigo-400">
                · {progressPct}% Completed
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Complete lessons, submit required assignments, and pass quizzes to unlock your verified credential.
            </p>
          </div>

          <div>
            {progress.certificate ? (
              <button
                onClick={() => onOpenCertificate(progress.certificate!)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Award className="w-4 h-4" />
                <span>View Certificate ({progress.certificate.certificateId})</span>
              </button>
            ) : progressPct >= 75 ? (
              <button
                onClick={handleClaimCertificate}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all hover:scale-102 cursor-pointer"
              >
                <Award className="w-4 h-4" />
                <span>Claim Official Certificate</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>Certificate unlocks at 75% complete</span>
              </div>
            )}
          </div>
        </div>

        {/* Linear Progress Bar */}
        <div className="mt-4">
          <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-mono">
            <span>{progress.completedLessonIds.length} Lessons Viewed</span>
            <span>{progress.completedAssignmentIds.length} Assignments Submitted</span>
            <span>{progress.passedQuizIds.length} Quizzes Passed</span>
          </div>
        </div>
      </div>

      {/* Quizzes & Examinations Module */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Multiple Choice Quizzes & Exams
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">Automated Scoring Engine</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quizzes.map((quiz) => {
            const hasPassed = progress.passedQuizIds.includes(quiz.id);
            const userSubmissions = ClassroomDB.getQuizSubmissions(quiz.id, currentUser.id);
            const latestSub = userSubmissions[0];

            return (
              <div
                key={quiz.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 font-mono">
                      MCQ Assessment
                    </span>
                    {hasPassed ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/60">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Passed ({latestSub?.score || 100}%)</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full font-medium border border-amber-200/60 dark:border-amber-800/60">
                        Passing Score: {quiz.passingScore}%
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-2">{quiz.title}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">{quiz.description}</p>

                  <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-3 font-mono">
                    <span>{quiz.questions.length} Questions</span>
                    <span>·</span>
                    <span>{quiz.durationMinutes} Minutes</span>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {latestSub
                      ? `Last Attempt: ${latestSub.submittedAt} (${latestSub.score}%)`
                      : 'Not attempted yet'}
                  </span>
                  <button
                    onClick={() => handleStartQuiz(quiz)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    <span>{latestSub ? 'Retake Quiz' : 'Take Quiz'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Assignments & Homework Module */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Course Assignments & Submissions
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">Grading & Rubrics</span>
        </div>

        <div className="space-y-4">
          {assignments.map((assignment) => {
            const userSubmissions = ClassroomDB.getSubmissions(assignment.id, currentUser);
            const mySubmission = userSubmissions[0];
            const allSubmissionsForAdmin =
              currentUser.role === 'admin' || currentUser.role === 'co_admin'
                ? ClassroomDB.getSubmissions(assignment.id, currentUser)
                : [];

            return (
              <div
                key={assignment.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
                      <span>Due: {assignment.dueDate}</span>
                      <span>·</span>
                      <span>Max Points: {assignment.maxPoints} pts</span>
                    </div>

                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1">
                      {assignment.title}
                    </h3>

                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-2 leading-relaxed">
                      {assignment.description}
                    </p>

                    {/* Rubric Matrix */}
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                        Grading Criteria Rubric:
                      </span>
                      <ul className="mt-1 space-y-1">
                        {assignment.rubricItems.map((item, idx) => (
                          <li
                            key={idx}
                            className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Right Action / Submission Status Box */}
                  <div className="w-full md:w-64 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col justify-between shrink-0">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                        {currentUser.role === 'admin' || currentUser.role === 'co_admin' ? 'Classroom Submissions' : 'Your Work'}
                      </span>

                      {currentUser.role === 'student' ? (
                        mySubmission ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{mySubmission.status === 'graded' ? 'Graded' : 'Turned In'}</span>
                              </span>
                              {mySubmission.grade !== undefined && (
                                <span className="text-xs font-bold font-mono text-indigo-700">
                                  {mySubmission.grade} / {assignment.maxPoints}
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-slate-600 truncate bg-white p-2 rounded border border-slate-200">
                              📄 {mySubmission.fileAttachment?.name}
                            </div>

                            {mySubmission.feedback && (
                              <div className="text-[11px] text-slate-600 bg-indigo-50/70 p-2 rounded border border-indigo-100">
                                <span className="font-semibold text-indigo-900 block">Feedback:</span>
                                {mySubmission.feedback}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500">
                            Status: <span className="font-semibold text-amber-600">Assigned</span>
                          </div>
                        )
                      ) : (
                        <div className="text-xs text-slate-600 space-y-1">
                          <div>
                            <span className="font-semibold text-slate-900 font-mono">
                              {allSubmissionsForAdmin.length}
                            </span>{' '}
                            student submissions received
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {allSubmissionsForAdmin.filter((s) => s.status === 'graded').length} graded
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 mt-3 border-t border-slate-200">
                      {currentUser.role === 'student' ? (
                        <button
                          onClick={() => setActiveAssignmentForSubmit(assignment)}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg shadow-sm transition-colors cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{mySubmission ? 'Resubmit Homework' : 'Submit Homework'}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setActiveAssignmentForGrading(assignment)}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
                        >
                          <span>Review & Grade Submissions</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Student Upload Homework Modal - Responsive Mobile & Desktop */}
      {activeAssignmentForSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 sm:p-6 max-h-[92vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-slate-900">
              Submit Assignment: {activeAssignmentForSubmit.title}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Upload your assignment files (PDF, ZIP, or Code) and write submission notes.
            </p>

            <form onSubmit={handleStudentSubmitHomework} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Attachment File
                </label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                  <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                  <input
                    type="file"
                    id="homework-file-input"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSubmissionFile(e.target.files[0]);
                        setSubmissionFileName(e.target.files[0].name);
                      }
                    }}
                  />
                  <label htmlFor="homework-file-input" className="cursor-pointer">
                    <span className="text-xs font-semibold text-indigo-600 hover:underline">
                      Click to choose file
                    </span>{' '}
                    <span className="text-xs text-slate-500">or drop here</span>
                    <p className="text-[11px] text-slate-400 mt-1">PDF, ZIP, or SQL files up to 25MB</p>
                  </label>
                </div>
                {submissionFileName && (
                  <p className="text-xs text-indigo-600 font-medium mt-1.5">
                    Selected: {submissionFileName}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Private Note to Instructor
                </label>
                <textarea
                  rows={3}
                  value={submissionComment}
                  onChange={(e) => setSubmissionComment(e.target.value)}
                  placeholder="Explain your approach, assumptions, or implementation highlights..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveAssignmentForSubmit(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Uploading...' : 'Confirm Submission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Review & Grade Submissions Modal */}
      {activeAssignmentForGrading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Grade Submissions: {activeAssignmentForGrading.title}
                </h3>
                <span className="text-xs text-slate-500">
                  Max: {activeAssignmentForGrading.maxPoints} pts
                </span>
              </div>
              <button
                onClick={() => {
                  setActiveAssignmentForGrading(null);
                  setSelectedSubmissionToGrade(null);
                }}
                className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* List of Student Submissions */}
            <div className="space-y-3 mt-4">
              {ClassroomDB.getSubmissions(activeAssignmentForGrading.id, currentUser).length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  No submissions submitted yet by students in this batch.
                </p>
              ) : (
                ClassroomDB.getSubmissions(activeAssignmentForGrading.id, currentUser).map((sub) => (
                  <div
                    key={sub.id}
                    className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={sub.studentAvatar}
                        alt={sub.studentName}
                        className="w-9 h-9 rounded-full object-cover border border-slate-200"
                      />
                      <div>
                        <span className="text-xs font-semibold text-slate-900 block">
                          {sub.studentName}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Submitted: {sub.submittedAt}
                        </span>
                        <p className="text-xs text-slate-700 mt-1.5 italic">
                          "{sub.submissionText}"
                        </p>
                        <div className="text-[11px] text-indigo-600 font-mono mt-1">
                          File: {sub.fileAttachment?.name} ({sub.fileAttachment?.size})
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {sub.status === 'graded' ? (
                        <div className="mb-2">
                          <span className="text-xs font-bold font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            {sub.grade} / {activeAssignmentForGrading.maxPoints} pts
                          </span>
                        </div>
                      ) : (
                        <div className="mb-2">
                          <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                            Pending Grade
                          </span>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setSelectedSubmissionToGrade(sub);
                          setGradeInput(sub.grade || 95);
                          setFeedbackInput(sub.feedback || 'Good work on architecture design.');
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg shadow-sm transition-colors cursor-pointer"
                      >
                        {sub.status === 'graded' ? 'Edit Grade' : 'Grade Submission'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Individual Grading Form */}
            {selectedSubmissionToGrade && (
              <form
                onSubmit={handleAdminGradeSubmit}
                className="mt-5 p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-3"
              >
                <div className="text-xs font-semibold text-indigo-950">
                  Grading: {selectedSubmissionToGrade.studentName}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-700 mb-1">
                      Score (out of {activeAssignmentForGrading.maxPoints})
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={activeAssignmentForGrading.maxPoints}
                      value={gradeInput}
                      onChange={(e) => setGradeInput(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 mb-1">Instructor Feedback</label>
                    <input
                      type="text"
                      value={feedbackInput}
                      onChange={(e) => setFeedbackInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSubmissionToGrade(null)}
                    className="px-3 py-1 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    Save Grade & Notify Student
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Interactive MCQ Quiz Runner Modal - Responsive Mobile & Desktop */}
      {activeQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 sm:p-6 max-h-[92vh] overflow-y-auto">
            {!quizSubmittedResult ? (
              <div>
                {/* Quiz Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{activeQuiz.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-0.5">
                      <span>
                        Question {currentQuestionIndex + 1} of {activeQuiz.questions.length}
                      </span>
                      <span>·</span>
                      <span>Pass Mark: {activeQuiz.passingScore}%</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveQuiz(null)}
                    className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    Exit
                  </button>
                </div>

                {/* Current Question Body */}
                <div className="py-6">
                  <p className="text-sm font-semibold text-slate-900 leading-snug">
                    {activeQuiz.questions[currentQuestionIndex].question}
                  </p>

                  <div className="mt-4 space-y-2.5">
                    {activeQuiz.questions[currentQuestionIndex].options.map((opt, optIdx) => {
                      const qId = activeQuiz.questions[currentQuestionIndex].id;
                      const isSelected = selectedAnswers[qId] === optIdx;

                      return (
                        <div
                          key={optIdx}
                          onClick={() => handleSelectQuizOption(qId, optIdx)}
                          className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex items-start gap-3 ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-medium shadow-xs'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-mono ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                : 'border-slate-300 text-slate-500'
                            }`}
                          >
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span className="flex-1">{opt}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Navigation & Submit Bar */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={currentQuestionIndex === 0}
                    onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                  >
                    Previous
                  </button>

                  <div className="flex items-center gap-2">
                    {currentQuestionIndex < activeQuiz.questions.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
                      >
                        Next Question
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSubmitQuiz}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg shadow-sm transition-colors cursor-pointer"
                      >
                        Submit Exam
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Quiz Results & Automated Scoring Screen */
              <div className="text-center py-4 space-y-4">
                <div
                  className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center ${
                    quizSubmittedResult.passed
                      ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-rose-100 text-rose-600'
                  }`}
                >
                  {quizSubmittedResult.passed ? (
                    <CheckCircle2 className="w-8 h-8" />
                  ) : (
                    <AlertCircle className="w-8 h-8" />
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {quizSubmittedResult.passed ? 'Assessment Passed!' : 'Did Not Meet Passing Mark'}
                  </h3>
                  <div className="text-2xl font-bold font-mono text-indigo-600 mt-1">
                    {quizSubmittedResult.score}%
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {quizSubmittedResult.passed
                      ? 'Congratulations! Your score has been recorded and accredited toward your certificate.'
                      : `Passing threshold is ${activeQuiz.passingScore}%. You may review the explanations below and retake.`}
                  </p>
                </div>

                {/* Explanations Review */}
                <div className="text-left max-h-60 overflow-y-auto space-y-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200">
                  {activeQuiz.questions.map((q, idx) => {
                    const studentChoice = selectedAnswers[q.id];
                    const isCorrect = studentChoice === q.correctIndex;

                    return (
                      <div key={q.id} className="text-xs p-2.5 rounded bg-white border border-slate-200">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <span>{idx + 1}.</span>
                          <span>{q.question}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-600">
                          <span className="font-semibold">Your Answer: </span>
                          <span className={isCorrect ? 'text-emerald-600' : 'text-rose-600'}>
                            {q.options[studentChoice] || 'Unanswered'}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-indigo-900 bg-indigo-50/70 p-1.5 rounded">
                          💡 {q.explanation}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setActiveQuiz(null)}
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    Finish Review
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
