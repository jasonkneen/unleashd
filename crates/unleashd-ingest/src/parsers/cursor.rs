//! Cursor IDE agent transcripts: `~/.cursor/projects/<encoded>/agent-transcripts/<id>/<id>.jsonl`.
//! Port of `parseCursorTranscriptFile`.
//!
//! The lines carry no timestamps. The TS parser stamped every message with the file's current
//! mtime, so each append re-dated the whole history; here message times are `null` and only the
//! session's times come from the file (and the first prompt's `<timestamp>` tag).

use super::{Ctx, Facts, Fold, Line, Previous, Sink, normalize_dir, parse_iso};
use crate::markers::Rebuild;
use crate::model::{Cwd, Provider, Role};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::LazyLock;

static TIMESTAMP_TAG: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"<timestamp>([^<]+)</timestamp>").unwrap());

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct CursorFold {
    messages: u64,
    prev: Previous,
    /// The first prompt's `<timestamp>` tag, when the first message is a prompt that has one.
    created_tag: Option<f64>,
}

fn content(blocks: &[Value]) -> (String, Option<Vec<Value>>) {
    let mut text = Vec::new();
    let mut parts = Vec::new();
    let mut has_tools = false;
    for block in blocks {
        match block.get("type").and_then(Value::as_str) {
            Some("text") => {
                if let Some(t) = block.get("text").and_then(Value::as_str).filter(|t| !t.is_empty()) {
                    text.push(t);
                    parts.push(serde_json::json!({ "t": "text", "text": t }));
                }
            }
            Some("tool_use") => {
                if let Some(name) = block.get("name").and_then(Value::as_str) {
                    has_tools = true;
                    parts.push(serde_json::json!({ "t": "tool", "name": name, "input": block.get("input") }));
                }
            }
            _ => {}
        }
    }
    let text = text.join("\n");
    (text, has_tools.then_some(parts))
}

impl Fold for CursorFold {
    fn line(&mut self, text: &str, sink: &mut Sink) -> Result<Line, Rebuild> {
        // Control rows (`turn_ended`) are the only lines holding that word.
        if text.contains("\"turn_ended\"") {
            return Ok(Line::Skipped);
        }
        let Ok(entry) = serde_json::from_str::<Value>(text) else { return Ok(Line::Malformed) };
        let role = match entry.get("role").and_then(Value::as_str) {
            Some("user") => Role::User,
            Some("assistant") => Role::Assistant,
            _ => return Ok(Line::Skipped),
        };
        let Some(Value::Array(blocks)) = entry.get("message").and_then(|m| m.get("content")) else { return Ok(Line::Skipped) };
        let (body, parts) = content(blocks);
        let identity = parts.as_ref().map(|parts| Value::Array(parts.clone()).to_string()).unwrap_or_else(|| body.clone());
        if identity.is_empty() || self.prev.is_duplicate(role, &identity) {
            return Ok(Line::Used);
        }
        if self.messages == 0 && role == Role::User {
            self.created_tag = TIMESTAMP_TAG.captures(&body).and_then(|c| parse_iso(&c[1]));
        }
        self.messages += 1;
        self.prev.set(role, &identity, None);
        if let Some(parts) = parts { sink.push_parts(role, None, None, body, parts); }
        else { sink.push(role, None, None, body, None)?; }
        Ok(Line::Used)
    }

    fn facts(&self, ctx: &Ctx) -> Option<Facts> {
        if self.messages == 0 {
            return None;
        }
        // <encoded project>/agent-transcripts/<session>/<session>.jsonl
        let encoded = ctx.path.ancestors().nth(3).and_then(|p| p.file_name()).and_then(|n| n.to_str()).unwrap_or("");
        let cwd = match ctx.resolver.cursor_cwd(encoded) {
            Cwd::ProjectDir { path } => Cwd::ProjectDir { path: normalize_dir(&path) },
            Cwd::Decoded { path } => Cwd::Decoded { path: normalize_dir(&path) },
            other => other,
        };
        Some(Facts {
            session_id: ctx.stem(".jsonl"),
            provider: Provider::Cursor,
            cwd,
            model: None,
            title: None,
            span: self.created_tag.map(|at| (at, ctx.mtime_ms.max(at))),
            parent_session_id: None,
            usage: None,
            sub_agents: Vec::new(),
            context: None,
            rate_limits: None,
        })
    }
}
