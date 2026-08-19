function emptyState() {
  return { ok: true, count: 0, issues: [], rawCount: 0, truncated: false, error: "" }
}

function normalizedIssue(issue) {
  var status = issue && issue.status && typeof issue.status === "object" ? issue.status : {}
  var priority = issue && issue.priority && typeof issue.priority === "object" ? issue.priority : {}
  var dueDate = String(issue && issue.dueDate ? issue.dueDate : "")
  return {
    key: String(issue && issue.issueKey ? issue.issueKey : ""),
    summary: String(issue && issue.summary ? issue.summary : ""),
    status: String(status.name || ""),
    priority: String(priority.name || ""),
    dueDate: dueDate.substring(0, 10)
  }
}

function isCompleted(issue) {
  var status = issue && issue.status && typeof issue.status === "object" ? issue.status : {}
  var name = String(status.name || "").trim().toLowerCase()
  return Number(status.id || 0) === 4
    || name === "完了"
    || name === "closed"
    || name === "completed"
}

function parseResponse(raw, limit, fetchLimit) {
  var text = String(raw || "").trim()
  if (text === "") return { ok: false, count: 0, issues: [], rawCount: 0, truncated: false, error: "Bee returned no data" }
  try {
    var parsed = JSON.parse(text)
    if (!Array.isArray(parsed))
      return { ok: false, count: 0, issues: [], rawCount: 0, truncated: false, error: "Bee returned an unexpected response" }
    var visible = []
    for (var i = 0; i < parsed.length; i++) {
      if (isCompleted(parsed[i])) continue
      var issue = normalizedIssue(parsed[i])
      if (issue.key !== "") visible.push(issue)
    }
    var numericLimit = Number(limit)
    var numericFetchLimit = Number(fetchLimit)
    var rowLimit = isFinite(numericLimit) ? Math.max(1, Math.min(50, numericLimit)) : 10
    var requestedCount = isFinite(numericFetchLimit) ? Math.max(1, numericFetchLimit) : 100
    return {
      ok: true,
      count: visible.length,
      issues: visible.slice(0, rowLimit),
      rawCount: parsed.length,
      truncated: parsed.length >= requestedCount,
      error: ""
    }
  } catch (e) {
    return { ok: false, count: 0, issues: [], rawCount: 0, truncated: false, error: "Could not parse Bee's JSON output" }
  }
}

function redactSecrets(raw) {
  return String(raw || "")
    .replace(/([?&](?:apiKey|access_token|refresh_token|client_secret)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/(Bearer\s+)[A-Za-z0-9._~+\/=\-]+/gi, "$1[REDACTED]")
    .replace(/\b[A-Za-z0-9_\-]{32,}\b/g, "[REDACTED]")
}

function errorMessage(raw) {
  var text = redactSecrets(raw).trim()
  if (text === "") return "Bee could not refresh Backlog issues"
  try {
    var parsed = JSON.parse(text)
    if (parsed && typeof parsed === "object") {
      if (parsed.message) return String(parsed.message)
      if (parsed.error && typeof parsed.error === "string") return parsed.error
      if (parsed.error && parsed.error.message) return String(parsed.error.message)
      if (Array.isArray(parsed.errors) && parsed.errors.length > 0 && parsed.errors[0].message)
        return String(parsed.errors[0].message)
    }
  } catch (e) {}
  return text.replace(/\s+/g, " ").substring(0, 240)
}

function labelFor(state, loading, hasError) {
  if (loading && state.count === 0) return "BL …"
  if (hasError && state.count === 0) return "BL !"
  return "BL " + state.count + (state.truncated ? "+" : "") + (hasError ? " !" : "")
}

if (typeof module !== "undefined") {
  module.exports = {
    emptyState: emptyState,
    errorMessage: errorMessage,
    redactSecrets: redactSecrets,
    isCompleted: isCompleted,
    normalizedIssue: normalizedIssue,
    parseResponse: parseResponse,
    labelFor: labelFor
  }
}
