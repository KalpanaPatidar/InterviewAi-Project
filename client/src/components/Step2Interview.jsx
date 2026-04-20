import React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";
import maleVideo from "../assets/Videos/male-ai.mp4";
import femaleVideo from "../assets/Videos/female-ai.mp4";
import Timer from "./Timer";
import { ServerUrl } from "../App";
import { motion } from "motion/react";
import { FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";
import { BsArrowRight } from "react-icons/bs";

// ─────────────────────────────────────────────────────────────────────────────
// useSpeechToText — creates a brand-new recognition instance every time.
// This is the ONLY reliable way to avoid Chrome's abort-loop bug.
// ─────────────────────────────────────────────────────────────────────────────
function useSpeechToText(onTranscript) {
  const activeRef       = useRef(false);
  const instanceRef     = useRef(null);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);

  const supported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const destroyInstance = () => {
    if (!instanceRef.current) return;
    const r = instanceRef.current;
    r.onresult = null;
    r.onend    = null;
    r.onerror  = null;
    try { r.abort(); } catch (_) {}
    instanceRef.current = null;
  };

  const spawnAndStart = useCallback(() => {
    if (!activeRef.current) return;

    destroyInstance();

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r  = new SR();
    r.lang           = "en-US";
    r.continuous     = false;   // avoids Chrome abort-loop
    r.interimResults = false;   // only clean final text

    r.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript?.trim();
      if (text) onTranscriptRef.current(text);
    };

    // onerror fires BEFORE onend in Chrome — handle restart here, not in onend
    r.onerror = (e) => {
      if (e.error === "not-allowed") {
        alert("Microphone access denied. Please allow it in your browser settings.");
        activeRef.current = false;
        return;
      }
      // "aborted", "no-speech", "network" etc — just let onend handle the restart
    };

    r.onend = () => {
      instanceRef.current = null;
      if (activeRef.current) {
        // 250 ms gap so hardware fully releases before the next grab
        setTimeout(spawnAndStart, 250);
      }
    };

    try {
      r.start();
      instanceRef.current = r;
    } catch (_) {
      // race condition — retry
      setTimeout(spawnAndStart, 300);
    }
  }, []);

  const start = useCallback(() => {
    if (!supported || activeRef.current) return;
    activeRef.current = true;
    spawnAndStart();
  }, [supported, spawnAndStart]);

  const stop = useCallback(() => {
    activeRef.current = false;
    destroyInstance();
  }, []);

  useEffect(() => () => { activeRef.current = false; destroyInstance(); }, []);

  return { start, stop, supported };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step2Interview
// ─────────────────────────────────────────────────────────────────────────────
function Step2Interview({ interviewData, onFinish }) {
  const { interviewId, questions, userName } = interviewData;

  const [isIntroPhase,  setIsIntroPhase]  = useState(true);
  const [isMicOn,       setIsMicOn]       = useState(true);
  const [isListening,   setIsListening]   = useState(false);
  const [isAIPlaying,   setIsAIPlaying]   = useState(false);
  const [currentIndex,  setCurrentIndex]  = useState(0);
  const [answer,        setAnswer]        = useState("");
  const [feedback,      setFeedback]      = useState("");
  const [timeLeft,      setTimeLeft]      = useState(questions[0]?.timeLimit || 60);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [voiceGender,   setVoiceGender]   = useState("female");
  const [subtitle,      setSubtitle]      = useState("");

  // ✅ FIX: score state now tracks cumulative total so it can be displayed as a running score
  const [score,         setScore]         = useState(0);
  // ✅ NEW: track how many questions have been scored so we can show avg
  const [scoredCount,   setScoredCount]   = useState(0);

  const isMicOnRef     = useRef(true);
  const isAIPlayingRef = useRef(false);
  const videoRef       = useRef(null);

  const currentQuestion = questions[currentIndex];
  const videoSource     = voiceGender === "male" ? maleVideo : femaleVideo;

  // ── speech-to-text ────────────────────────────────────────────────
  const handleTranscript = useCallback((text) => {
    setAnswer((prev) => (prev.trim() ? prev.trim() + " " + text : text));
  }, []);

  const { start: _start, stop: _stop } = useSpeechToText(handleTranscript);

  const startMic = useCallback(() => {
    if (
      !isMicOnRef.current ||
      isAIPlayingRef.current ||
      isListening
    ) return;

    console.log("🎤 starting mic...");
    _start();
    setIsListening(true);
  }, [_start, isListening]);

  const stopMic = useCallback(() => {
    _stop();
    setIsListening(false);
  }, [_stop]);

  const toggleMic = () => {
    const next = !isMicOnRef.current;
    isMicOnRef.current = next;
    setIsMicOn(next);
    next ? startMic() : stopMic();
  };

  // ── voice loading ─────────────────────────────────────────────────
  useEffect(() => {
    const load = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      const female = voices.find((v) => /zira|samantha|female/i.test(v.name));
      const male   = voices.find((v) => /david|mark|male/i.test(v.name));
      if (female)      { setSelectedVoice(female); setVoiceGender("female"); }
      else if (male)   { setSelectedVoice(male);   setVoiceGender("male");   }
      else             { setSelectedVoice(voices[0]); setVoiceGender("female"); }
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, []);

  // ── text-to-speech ────────────────────────────────────────────────
  const speakText = useCallback((text) => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis || !selectedVoice) { resolve(); return; }

      window.speechSynthesis.cancel();
      stopMic();

      const utterance = new SpeechSynthesisUtterance(
        text.replace(/,/g, ", ...").replace(/\./g, ". ... ")
      );
      utterance.voice  = selectedVoice;
      utterance.rate   = 0.92;
      utterance.pitch  = 1.05;
      utterance.volume = 1;

      utterance.onstart = () => {
        isAIPlayingRef.current = true;
        setIsAIPlaying(true);
        setSubtitle(text);
        if (videoRef.current) { videoRef.current.currentTime = 0; videoRef.current.play(); }
      };

      utterance.onend = () => {
        isAIPlayingRef.current = false;
        setIsAIPlaying(false);
        setSubtitle("");
        if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
        if (isMicOnRef.current) setTimeout(startMic, 400);
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }, [selectedVoice, startMic, stopMic]);

  // ── intro + question flow ─────────────────────────────────────────
  useEffect(() => {
    if (!selectedVoice) return;
    const run = async () => {
      if (isIntroPhase) {
        await speakText(`Hi ${userName}...`);
        await speakText("I will ask you a few questions.");
        setIsIntroPhase(false);
      } else if (currentQuestion) {
        await new Promise((r) => setTimeout(r, 600));
        if (currentIndex === questions.length - 1)
          await speakText("Alright, this one might be a bit more challenging.");
        await speakText(currentQuestion.question);
        // speakText onend already calls startMic
      }
    };
    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVoice, isIntroPhase, currentIndex]);

  // ── timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isIntroPhase || !currentQuestion) return;
    const id = setInterval(() => {
      setTimeLeft((p) => { if (p <= 1) { clearInterval(id); return 0; } return p - 1; });
    }, 1000);
    return () => clearInterval(id);
  }, [isIntroPhase, currentIndex]);

  useEffect(() => {
    if (!isIntroPhase && currentQuestion) setTimeLeft(currentQuestion.timeLimit || 60);
  }, [currentIndex]);

  // ── submit (all refs to avoid stale closures) ─────────────────────
  const answerRef       = useRef(answer);
  const timeLeftRef     = useRef(timeLeft);
  const isSubmittingRef = useRef(false);
  const feedbackRef     = useRef(feedback);
  const speakTextRef    = useRef(null);
  const currentIndexRef = useRef(currentIndex);

  useEffect(() => { answerRef.current       = answer;       }, [answer]);
  useEffect(() => { timeLeftRef.current     = timeLeft;     }, [timeLeft]);
  useEffect(() => { feedbackRef.current     = feedback;     }, [feedback]);
  useEffect(() => { speakTextRef.current    = speakText;    }, [speakText]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  const submitAnswer = useCallback(async () => {
    if (isSubmittingRef.current) return;
    stopMic();
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const currentQ  = questions[currentIndexRef.current];
    const timeTaken = (currentQ?.timeLimit || 60) - timeLeftRef.current;

    try {
      const res = await axios.post(
        ServerUrl + "/api/interview/submit-answer",
        {
          interviewId,
          questionIndex: currentIndexRef.current,
          answer: answerRef.current,
          timeTaken,
        },
        { withCredentials: true }
      );

      const { feedback: feedbackText, score: newScore } = res.data;

      setFeedback(feedbackText);

      // ✅ FIX: backend now always returns score (0 for no-answer, number for answered)
      // typeof check still kept as a safety guard
   if (typeof newScore === "number") {
  setScore((prev) => prev + newScore);
  setScoredCount((prev) => prev + 1);
  console.log("✅ Score updated:", newScore); // ← add this temporarily
}

      if (speakTextRef.current) speakTextRef.current?.(feedbackText);

    } catch (err) {
      console.error("Submit error:", err);
      setFeedback("Could not get feedback. Please continue to the next question.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [interviewId, questions, stopMic]);

  // Auto-submit when timer hits 0
  useEffect(() => {
    if (!isIntroPhase && currentQuestion && timeLeft === 0
        && !isSubmittingRef.current && !feedbackRef.current) {
      submitAnswer();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  // ── next question ─────────────────────────────────────────────────
  const handleNext = async () => {
    stopMic();

    setAnswer("");
    setFeedback("");
    feedbackRef.current = "";   // ✅ reset ref too

    if (currentIndex + 1 >= questions.length) {
      finishInterview();
      return;
    }

    await speakText("Alright, let's move to the next question.");
    setCurrentIndex((p) => p + 1);
  };

  // ── finish ────────────────────────────────────────────────────────
  const finishInterview = async () => {
    stopMic(); isMicOnRef.current = false; setIsMicOn(false);
    try {
      const res = await axios.post(ServerUrl + "/api/interview/finish",
        { interviewId }, { withCredentials: true });
      onFinish(res.data);
    } catch (err) { console.error("Finish error:", err); }
  };

  // ── cleanup ───────────────────────────────────────────────────────
  useEffect(() => () => { _stop(); window.speechSynthesis.cancel(); }, [_stop]);

  // ── derived: running average score to display ─────────────────────
  const runningAvg = scoredCount > 0 ? (score / scoredCount).toFixed(1) : "—";

  // ── render ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[1400px] min-h-[80vh] bg-white rounded-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden">

        {/* Left Panel */}
        <div className="w-full lg:w-[55%] bg-white flex flex-col items-center p-6 space-y-4 border-r border-gray-200">
          <div className="w-full max-w-md rounded-2xl overflow-hidden">
            <video src={videoSource} key={videoSource} ref={videoRef}
              muted playsInline preload="auto"
              className="w-full h-auto object-cover rounded-2xl" />
          </div>

          {subtitle && (
            <div className="w-full max-w-md bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm">
              <p className="text-gray-700 text-sm font-medium text-center leading-relaxed">{subtitle}</p>
            </div>
          )}

          <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-md p-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Interview Status</span>
              {isAIPlaying  && <span className="text-sm font-semibold text-emerald-600 animate-pulse">🔊 AI Speaking</span>}
              {isListening && !isAIPlaying && <span className="text-sm font-semibold text-blue-500 animate-pulse">🎤 Listening…</span>}
              {!isListening && !isAIPlaying && !isIntroPhase && <span className="text-sm text-gray-400">Idle</span>}
            </div>
            <div className="h-px bg-gray-200" />
            <div className="flex justify-center">
              <Timer timeLeft={timeLeft} totalTime={currentQuestion?.timeLimit || 60} />
            </div>
            <div className="h-px bg-gray-200" />
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-emerald-600">{currentIndex + 1}</span>
                <span className="text-xs text-gray-400">Current Q</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-emerald-600">{questions.length}</span>
                <span className="text-xs text-gray-400">Total Q</span>
              </div>
              {/* ✅ NEW: Running average score shown live during interview */}
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-emerald-600">{runningAvg}</span>
                <span className="text-xs text-gray-400">Avg Score</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-8">
          <h2 className="text-xl sm:text-2xl font-bold text-emerald-600 mb-6">AI Smart Interview</h2>

          {!isIntroPhase && currentQuestion && (
            <div className="mb-6 bg-gray-50 p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-sm">
              <p className="text-xs sm:text-sm text-gray-400 mb-2">Question {currentIndex + 1} of {questions.length}</p>
              <p className="text-base sm:text-lg font-semibold text-gray-800 leading-relaxed">{currentQuestion.question}</p>
            </div>
          )}

          <textarea
            value={answer}
            placeholder="Speak your answer — it will appear here automatically. You can also type."
            onChange={(e) => setAnswer(e.target.value)}
            className="flex-1 bg-gray-100 p-4 sm:p-6 rounded-2xl resize-none outline-none border border-gray-200 focus:ring-2 focus:ring-emerald-500 transition text-gray-800 min-h-[160px]"
          />

          {!feedback ? (
            <div className="flex items-center gap-4 mt-6">
              <motion.button onClick={toggleMic} whileTap={{ scale: 0.9 }}
                title={isMicOn ? "Mute microphone" : "Unmute microphone"}
                className={`w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full shadow-lg transition-all ${
                  isMicOn
                    ? isListening ? "bg-blue-500 text-white ring-4 ring-blue-300" : "bg-black text-white"
                    : "bg-red-500 text-white"
                }`}>
                {isMicOn ? <FaMicrophone size={20} /> : <FaMicrophoneSlash size={20} />}
              </motion.button>

              <motion.button onClick={submitAnswer} disabled={isSubmitting} whileTap={{ scale: 0.95 }}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-500 text-white py-3 sm:py-4 rounded-2xl shadow-lg hover:opacity-90 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                {isSubmitting ? "Submitting..." : "Submit Answer"}
              </motion.button>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-6 bg-emerald-50 border border-emerald-200 p-5 rounded-2xl shadow-sm">
              <p className="text-emerald-700 font-medium mb-4">{feedback}</p>
              <button onClick={handleNext}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 text-white py-3 rounded-xl shadow-md hover:opacity-90 transition flex items-center justify-center gap-2">
                {currentIndex + 1 >= questions.length ? "Finish Interview" : "Next Question"}
                <BsArrowRight size={18} />
              </button>
            </motion.div>
          )}
        </div>

      </div>
    </div>
  );
}

export default Step2Interview;
