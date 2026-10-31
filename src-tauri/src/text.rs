//! Authored errors share the frontend's editable catalog. Rebuilt into the installed app.
use std::sync::OnceLock;

fn catalog() -> &'static serde_json::Value {
    static CATALOG: OnceLock<serde_json::Value> = OnceLock::new();
    CATALOG.get_or_init(|| serde_json::from_str(include_str!("../../src/text/strings.json"))
        .expect("strings.json must contain valid JSON"))
}

pub fn text(key: &'static str) -> &'static str {
    let mut value = catalog();
    for part in key.split('.') {
        let Some(next) = value.get(part) else { return key; };
        value = next;
    }
    value.as_str().unwrap_or(key)
}

/// One pass: braces in inserted error details are never interpreted as placeholders.
pub fn format(key: &'static str, values: &[(&str, String)]) -> String {
    let mut rest = text(key);
    let mut result = String::new();
    while let Some(start) = rest.find('{') {
        result.push_str(&rest[..start]);
        rest = &rest[start..];
        let Some(end) = rest.find('}') else { break; };
        let name = &rest[1..end];
        if let Some((_, value)) = values.iter().find(|(key, _)| *key == name) {
            result.push_str(value);
        } else {
            result.push_str(&rest[..=end]);
        }
        rest = &rest[end + 1..];
    }
    result.push_str(rest);
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shared_copy_and_missing_keys() {
        assert_eq!(text("common.save"), catalog()["common"]["save"].as_str().unwrap());
        assert_eq!(text("missing.message"), "missing.message");
    }

    #[test]
    fn interpolation_is_literal_and_keeps_missing_tokens() {
        let key = "errors.db.unknownRankTier";
        let raw = text(key);
        assert!(raw.contains("{tier}"));
        assert_eq!(format(key, &[]), raw);
        assert_eq!(format(key, &[("tier", "Gold {tier} $&".into())]), raw.replace("{tier}", "Gold {tier} $&"));
    }
}
