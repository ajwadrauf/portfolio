"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./InterviewPractice.module.css";

const REHEARSAL_MS = 90_000;
const NOTES_KEY = "ajwad-interview-studio-notes-v1";

type InterviewQuestion = { question: string; listenFor: string };

export function PrintGuideButton() {
  return (
    <button type="button" className={`${styles.button} ${styles.printControl}`} onClick={() => window.print()}>
      Print or save this guide <span aria-hidden="true">↗</span>
    </button>
  );
}

export function InterviewPractice({ questions }: { questions: Array<InterviewQuestion> }) {
  const id = useId();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [remainingMs, setRemainingMs] = useState(REHEARSAL_MS);
  const [running, setRunning] = useState(false);
  const deadline = useRef<number | null>(null);
  const [notes, setNotes] = useState("");
  const [notesReady, setNotesReady] = useState(false);
  const [notesStatus, setNotesStatus] = useState("Loading your notes…");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(NOTES_KEY);
      if (saved !== null) setNotes(saved);
      setNotesStatus(saved !== null ? "Restored from this browser." : "Notes will save on this browser as you type.");
    } catch {
      setNotesStatus("Browser storage is unavailable. You can write here, but copy or print your notes before leaving.");
    }
    setNotesReady(true);
  }, []);

  useEffect(() => {
    if (!running) return;
    const update = () => {
      const remaining = Math.max(0, (deadline.current ?? Date.now()) - Date.now());
      setRemainingMs(remaining);
      if (remaining === 0) {
        deadline.current = null;
        setRunning(false);
      }
    };
    update();
    const interval = window.setInterval(update, 200);
    return () => window.clearInterval(interval);
  }, [running]);

  function resetTimer() {
    deadline.current = null;
    setRunning(false);
    setRemainingMs(REHEARSAL_MS);
  }

  function toggleTimer() {
    if (running) {
      setRemainingMs(Math.max(0, (deadline.current ?? Date.now()) - Date.now()));
      deadline.current = null;
      setRunning(false);
      return;
    }
    const remaining = remainingMs > 0 ? remainingMs : REHEARSAL_MS;
    setRemainingMs(remaining);
    deadline.current = Date.now() + remaining;
    setRunning(true);
  }

  function changeQuestion(next: number) {
    setQuestionIndex(next);
    setShowHint(false);
    resetTimer();
  }

  function shuffleQuestion() {
    if (questions.length < 2) return;
    const offset = 1 + Math.floor(Math.random() * (questions.length - 1));
    changeQuestion((questionIndex + offset) % questions.length);
  }

  function saveNotes(value: string) {
    setNotes(value);
    try {
      window.localStorage.setItem(NOTES_KEY, value);
      setNotesStatus("Saved on this browser.");
    } catch {
      setNotesStatus("Not saved. Browser storage is unavailable or full. Copy or print your notes before leaving.");
    }
  }

  const question = questions[questionIndex % questions.length];
  const seconds = Math.ceil(remainingMs / 1000);
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const timerStatus = remainingMs === 0
    ? "Time is up. Land your last sentence, then reflect."
    : running
      ? "Timer running. Say your answer out loud."
      : remainingMs < REHEARSAL_MS
        ? "Timer paused. Resume when you are ready."
        : "Ready when you are. Aim for one clear answer.";

  return (
    <div className={styles.practice}>
      <div className={styles.workspace}>
        <div className={styles.questionCard}>
          <p className={styles.eyebrow}>Rehearse out loud · one question at a time</p>
          <div className={styles.questionBody} aria-live="polite" aria-atomic="true">
            <p className={styles.position}>{questions.length ? `${questionIndex + 1} / ${questions.length}` : "Practice"}</p>
            <h3 className={styles.question}>{question?.question ?? "Tell me about the work you are most proud of."}</h3>
          </div>
          {question && (
            <>
              <button type="button" className={`${styles.hintButton} ${styles.screenOnly}`} aria-expanded={showHint} aria-controls={`${id}-hint`} onClick={() => setShowHint((visible) => !visible)}>
                {showHint ? "Hide coaching hint" : "Show coaching hint"} <span aria-hidden="true">{showHint ? "−" : "+"}</span>
              </button>
              <div id={`${id}-hint`} hidden={!showHint} className={styles.hint}>
                <p className={styles.eyebrow}>What to bring into your answer</p>
                <p>{question.listenFor}</p>
              </div>
            </>
          )}
          <div className={`${styles.questionControls} ${styles.screenOnly}`}>
            <button type="button" className={`${styles.button} ${styles.primaryButton}`} disabled={questions.length < 2} onClick={() => changeQuestion((questionIndex + 1) % questions.length)}>
              Next question <span aria-hidden="true">→</span>
            </button>
            <button type="button" className={styles.button} disabled={questions.length < 2} onClick={shuffleQuestion}>Shuffle question</button>
          </div>
        </div>

        <aside className={`${styles.timerCard} ${styles.screenOnly}`} aria-labelledby={`${id}-timer-heading`}>
          <h3 id={`${id}-timer-heading`} className={styles.eyebrow}>A 90-second answer</h3>
          <p className={styles.timer} role="timer" aria-label={`${seconds} seconds remaining`} aria-live="off">{time}</p>
          <div className={styles.timerTrack} aria-hidden="true"><span style={{ width: `${(remainingMs / REHEARSAL_MS) * 100}%` }} /></div>
          <p className={styles.timerStatus} role="status">{timerStatus}</p>
          <div className={styles.timerControls}>
            <button type="button" className={`${styles.button} ${styles.timerButton}`} onClick={toggleTimer}>{running ? "Pause timer" : remainingMs === 0 ? "Start again" : remainingMs < REHEARSAL_MS ? "Resume timer" : "Start timer"}</button>
            <button type="button" className={`${styles.button} ${styles.resetButton}`} onClick={resetTimer}>Reset</button>
          </div>
          <p className={styles.timerNote}>Start with your point. Give one example. Finish with what you learned.</p>
          <p className={styles.localNote}>This is a timer only. No microphone, recording or AI feedback.</p>
        </aside>
      </div>

      <div className={styles.notesCard}>
        <div className={styles.notesHeading}>
          <div>
            <label htmlFor={`${id}-notes`} className={styles.notesTitle}>Your rehearsal notes</label>
            <p id={`${id}-notes-help`} className={styles.notesHelp}>Keep the phrases that sound like you. Note where you rushed, lost the thread or wanted a stronger example.</p>
          </div>
          <PrintGuideButton />
        </div>
        <textarea id={`${id}-notes`} className={`${styles.notesInput} ${styles.screenOnly}`} rows={7} value={notes} disabled={!notesReady} onChange={(event) => saveNotes(event.target.value)} aria-describedby={`${id}-notes-help ${id}-notes-status`} placeholder="My clearest opening…&#10;An example I want to use…&#10;A question I want to ask them…" />
        <p id={`${id}-notes-status`} className={`${styles.storageStatus} ${styles.screenOnly}`} role="status">{notesStatus}</p>
        <p className={`${styles.notesHelp} ${styles.screenOnly}`}>Notes stay in this browser and are not uploaded. They can be read by someone using this browser profile.</p>
        <div className={styles.printNotes}>{notes || "Rehearsal notes:\n\n\n\n\n"}</div>
      </div>
    </div>
  );
}
