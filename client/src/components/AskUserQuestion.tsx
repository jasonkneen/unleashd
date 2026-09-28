/**
 * AskUserQuestion Widget
 *
 * Renders interactive question cards when Claude uses the AskUserQuestion tool.
 * Receives a typed question from the transcript ingress.
 *
 * This is display-only — Claude Code handles the actual tool response internally.
 * The widget shows the questions and options so the user can see what Claude is asking,
 * matching the native Claude Code terminal UI.
 */

import type { AskUserQuestion } from '@unleashd/shared';
import { useState } from 'react';
import './AskUserQuestion.css';

type Question = AskUserQuestion['questions'][number];

export function AskUserQuestionWidget({ data }: { data: AskUserQuestion }) {
  return (
    <div className="ask-user-question">
      {data.questions.map((q, qi) => (
        <QuestionCard key={qi} question={q} />
      ))}
    </div>
  );
}

function QuestionCard({ question }: { question: Question }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggle = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (question.multiSelect) {
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
      } else {
        // Single-select: clear and set
        next.clear();
        next.add(idx);
      }
      return next;
    });
  };

  return (
    <div className="ask-question-card ui-card">
      {question.header && <span className="ask-question-header">{question.header}</span>}
      <p className="ask-question-text">{question.question}</p>
      <div className="ask-question-options ui-stack">
        {question.options.map((opt, oi) => (
          <button
            type="button"
            key={oi}
            className={`ask-question-option ui-stack ui-card ${selected.has(oi) ? 'selected' : ''}`}
            onClick={() => toggle(oi)}
          >
            <span className="option-label">{opt.label}</span>
            {opt.description && <span className="option-description">{opt.description}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
