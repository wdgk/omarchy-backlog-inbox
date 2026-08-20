function emptyState() {
  return { ok: true, count: 0, issues: [], allIssues: [], rawCount: 0, truncated: false, error: "" }
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

function localDateKey(value) {
  var date = value instanceof Date ? value : new Date(value)
  if (isNaN(date.getTime())) return ""
  var year = String(date.getFullYear())
  var monthNumber = date.getMonth() + 1
  var dayNumber = date.getDate()
  var month = (monthNumber < 10 ? "0" : "") + String(monthNumber)
  var day = (dayNumber < 10 ? "0" : "") + String(dayNumber)
  return year + "-" + month + "-" + day
}

function dueState(dueDate, today) {
  var due = String(dueDate || "").substring(0, 10)
  var current = String(today || "").substring(0, 10)
  if (due === "") return "none"
  if (current === "") return "upcoming"
  if (due < current) return "overdue"
  if (due === current) return "today"
  return "upcoming"
}

function dueLabel(dueDate, today) {
  var due = String(dueDate || "").substring(0, 10)
  var state = dueState(due, today)
  if (state === "none") return "No due date"
  if (state === "overdue") return "Overdue · " + due
  if (state === "today") return "Due today · " + due
  return "Due " + due
}

function sortByDueDate(issues) {
  return issues.sort(function(a, b) {
    var left = String(a && a.dueDate ? a.dueDate : "")
    var right = String(b && b.dueDate ? b.dueDate : "")
    if (left === right) return 0
    if (left === "") return 1
    if (right === "") return -1
    return left < right ? -1 : 1
  })
}

function pageCount(itemCount, pageSize) {
  var count = Math.max(0, Number(itemCount) || 0)
  var size = Math.max(1, Math.min(50, Number(pageSize) || 10))
  return Math.max(1, Math.ceil(count / size))
}

function pageItems(issues, page, pageSize) {
  var items = Array.isArray(issues) ? issues : []
  var size = Math.max(1, Math.min(50, Number(pageSize) || 10))
  var lastPage = pageCount(items.length, size) - 1
  var currentPage = Math.max(0, Math.min(lastPage, Number(page) || 0))
  var start = currentPage * size
  return items.slice(start, start + size)
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
    sortByDueDate(visible)
    var numericLimit = Number(limit)
    var numericFetchLimit = Number(fetchLimit)
    var rowLimit = isFinite(numericLimit) ? Math.max(1, Math.min(50, numericLimit)) : 10
    var requestedCount = isFinite(numericFetchLimit) ? Math.max(1, numericFetchLimit) : 100
    return {
      ok: true,
      count: visible.length,
      issues: visible.slice(0, rowLimit),
      allIssues: visible,
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
    localDateKey: localDateKey,
    dueState: dueState,
    dueLabel: dueLabel,
    sortByDueDate: sortByDueDate,
    pageCount: pageCount,
    pageItems: pageItems,
    normalizedIssue: normalizedIssue,
    parseResponse: parseResponse,
    labelFor: labelFor
  }
}
