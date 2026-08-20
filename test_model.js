const assert = require("node:assert/strict")
const Model = require("./Model.js")

const response = JSON.stringify([
  {
    issueKey: "TEST-1",
    summary: "Visible issue",
    status: { id: 2, name: "処理中" },
    priority: { name: "高" },
    dueDate: "2026-08-21T00:00:00Z"
  },
  {
    issueKey: "TEST-2",
    summary: "Completed issue",
    status: { id: 4, name: "完了" }
  },
  {
    issueKey: "TEST-3",
    summary: "Another visible issue",
    status: { id: 1, name: "未対応" }
  }
])

const parsed = Model.parseResponse(response, 1, 100)
assert.equal(parsed.ok, true)
assert.equal(parsed.count, 2)
assert.equal(parsed.issues.length, 1)
assert.equal(parsed.issues[0].key, "TEST-1")
assert.equal(parsed.issues[0].dueDate, "2026-08-21")
assert.equal(Model.labelFor(parsed, false, true), "BL 2 !")

assert.equal(Model.localDateKey(new Date(2026, 7, 21)), "2026-08-21")
assert.equal(Model.dueState("", "2026-08-21"), "none")
assert.equal(Model.dueState("2026-08-20", "2026-08-21"), "overdue")
assert.equal(Model.dueState("2026-08-21", "2026-08-21"), "today")
assert.equal(Model.dueState("2026-08-22", "2026-08-21"), "upcoming")
assert.equal(Model.dueLabel("", "2026-08-21"), "No due date")
assert.equal(Model.dueLabel("2026-08-20", "2026-08-21"), "Overdue · 2026-08-20")
assert.equal(Model.dueLabel("2026-08-21", "2026-08-21"), "Due today · 2026-08-21")

const dueSorted = Model.parseResponse(JSON.stringify([
  { issueKey: "TEST-3", summary: "Undated", status: { id: 1, name: "Open" }, dueDate: null },
  { issueKey: "TEST-2", summary: "Later", status: { id: 1, name: "Open" }, dueDate: "2026-08-22" },
  { issueKey: "TEST-1", summary: "Earlier", status: { id: 1, name: "Open" }, dueDate: "2026-08-21" }
]), 10, 100)
assert.deepEqual(dueSorted.issues.map((issue) => issue.key), ["TEST-1", "TEST-2", "TEST-3"])
assert.equal(Model.pageCount(0, 10), 1)
assert.equal(Model.pageCount(15, 10), 2)
assert.deepEqual(Model.pageItems(dueSorted.allIssues, 0, 2).map((issue) => issue.key), ["TEST-1", "TEST-2"])
assert.deepEqual(Model.pageItems(dueSorted.allIssues, 1, 2).map((issue) => issue.key), ["TEST-3"])
assert.deepEqual(Model.pageItems(dueSorted.allIssues, 99, 2).map((issue) => issue.key), ["TEST-3"])

const fifteenIssues = Array.from({ length: 15 }, (_, i) => ({
  issueKey: "PAGE-" + (i + 1),
  summary: "Page test " + (i + 1),
  status: { id: 1, name: "Open" },
  dueDate: "2026-09-" + String(i + 1).padStart(2, "0")
}))
const paged = Model.parseResponse(JSON.stringify(fifteenIssues), 10, 100)
assert.equal(paged.issues.length, 10)
assert.equal(paged.allIssues.length, 15)
assert.equal(Model.pageCount(paged.count, 10), 2)
assert.equal(Model.pageItems(paged.allIssues, 1, 10).length, 5)
assert.equal(Model.errorMessage('{"message":"Not authenticated"}'), "Not authenticated")

const fullPage = []
for (let i = 0; i < 100; i++) {
  fullPage.push({
    issueKey: "TEST-" + (i + 1),
    summary: "Issue " + (i + 1),
    status: { id: i < 93 ? 4 : 49667, name: i < 93 ? "完了" : "工数入力待ち" },
    dueDate: null
  })
}
const truncated = Model.parseResponse(JSON.stringify(fullPage), 10, 100)
assert.equal(truncated.ok, true)
assert.equal(truncated.rawCount, 100)
assert.equal(truncated.count, 7)
assert.equal(truncated.truncated, true)
assert.equal(truncated.issues.length, 7)
assert.equal(truncated.issues[0].dueDate, "")
assert.equal(Model.labelFor(truncated, false, false), "BL 7+")

const empty = Model.parseResponse("[]", 10, 100)
assert.equal(empty.ok, true)
assert.equal(empty.count, 0)
assert.equal(empty.truncated, false)
assert.equal(Model.parseResponse("", 10, 100).ok, false)
assert.equal(Model.parseResponse("{}", 10, 100).ok, false)
assert.equal(Model.parseResponse("not json", 10, 100).ok, false)

const malformedIssues = Model.parseResponse(JSON.stringify([
  { issueKey: "TEST-1", status: {} },
  { issueKey: "TEST-2", status: "Closed" },
  { summary: "Missing key", status: { id: 1 } },
  { issueKey: "TEST-3", status: { id: 4, name: "Renamed" } },
  { issueKey: "TEST-4", status: { name: " CLOSED " } }
]), 50, 100)
assert.equal(malformedIssues.ok, true)
assert.deepEqual(malformedIssues.issues.map((issue) => issue.key), ["TEST-1", "TEST-2"])

assert.equal(Model.parseResponse(response, 0, 100).issues.length, 1)
assert.equal(Model.parseResponse(response, -1, 100).issues.length, 1)
assert.equal(Model.parseResponse(response, 51, 100).issues.length, 2)
assert.equal(Model.parseResponse(response, NaN, 100).issues.length, 2)

assert.equal(Model.errorMessage('{"errors":[{"message":"Invalid request"}]}'), "Invalid request")
assert.equal(
  Model.errorMessage("request failed: https://example.test/api?apiKey=secret-value&x=1"),
  "request failed: https://example.test/api?apiKey=[REDACTED]&x=1"
)
assert.equal(Model.errorMessage("Authorization: Bearer abc.def-123"), "Authorization: Bearer [REDACTED]")
assert.equal(Model.errorMessage("token abcdefghijklmnopqrstuvwxyz1234567890"), "token [REDACTED]")
assert.equal(Model.errorMessage("x".repeat(300)).length <= 240, true)

console.log("Model tests: ok")
