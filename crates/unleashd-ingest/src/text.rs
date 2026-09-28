//! Text rules shared by transcript parsers. Tool presentation belongs to the client;
//! provider blocks and Buddy results remain structured until the application ingress.

use serde_json::Value;

pub fn utf16_len(s: &str) -> usize {
    s.chars().map(char::len_utf16).sum()
}

/// The longest prefix of at most `units` UTF-16 code units. Where JS `slice` would cut a
/// surrogate pair in half (leaving a lone surrogate no Rust string can hold) this stops one unit
/// short instead.
pub fn utf16_prefix(s: &str, units: usize) -> &str {
    let mut used = 0;
    for (index, ch) in s.char_indices() {
        let next = used + ch.len_utf16();
        if next > units {
            return &s[..index];
        }
        used = next;
    }
    s
}

/// JS `String.prototype.trim` (Rust's `trim` misses U+FEFF, which JS treats as whitespace).
pub fn js_trim(s: &str) -> &str {
    s.trim_matches(|c: char| c.is_whitespace() || c == '\u{feff}')
}

pub fn js_trim_start(s: &str) -> &str {
    s.trim_start_matches(|c: char| c.is_whitespace() || c == '\u{feff}')
}

/// JS truthiness of a JSON value.
pub fn truthy(value: Option<&Value>) -> bool {
    match value {
        None | Some(Value::Null) => false,
        Some(Value::Bool(b)) => *b,
        Some(Value::Number(n)) => n.as_f64().is_some_and(|f| f != 0.0 && !f.is_nan()),
        Some(Value::String(s)) => !s.is_empty(),
        Some(Value::Array(_)) | Some(Value::Object(_)) => true,
    }
}


/// JSON.stringify(value, null, 2) for verbatim Codex tool arguments.
pub fn pretty_json(value: &Value) -> String {
    serde_json::to_string_pretty(value).expect("a serde_json::Value always serializes")
}

/// Select candidate Buddy receipts without formatting or validating their schema here.
/// The shared application ingress validates once; failed/preview results never become cards.
pub fn has_buddy_receipt(output: Option<&Value>) -> bool {
    fn visit(value: &Value, depth: usize) -> bool {
        if depth > 10 { return false; }
        match value {
            Value::String(text) => serde_json::from_str::<Value>(text).is_ok_and(|parsed| visit(&parsed, depth + 1)),
            Value::Array(items) => items.iter().any(|item| visit(item, depth + 1)),
            Value::Object(record) => {
                if ["isError", "is_error", "error", "preview"].iter().any(|key| truthy(record.get(*key))) {
                    return false;
                }
                if record.contains_key("buddyWorkerThread") || record.contains_key("buddyBuilderEvent") ||
                    (record.contains_key("conversationId") && record.contains_key("homeWorkspace") && record.contains_key("buddy")) {
                    return true;
                }
                ["structuredContent", "content", "text", "result", "data"].iter()
                    .any(|key| record.get(*key).is_some_and(|nested| visit(nested, depth + 1)))
            }
            _ => false,
        }
    }
    output.is_some_and(|value| visit(value, 0))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn receipt_candidates_exclude_failed_and_preview_envelopes() {
        let receipt = json!({ "buddyWorkerThread": { "conversationId": "c", "buddyId": "b", "label": "L" } });
        assert!(has_buddy_receipt(Some(&json!({ "content": receipt }))));
        assert!(!has_buddy_receipt(Some(&json!({ "isError": true, "content": receipt }))));
        assert!(!has_buddy_receipt(Some(&json!({ "preview": true, "data": receipt }))));
    }
}
