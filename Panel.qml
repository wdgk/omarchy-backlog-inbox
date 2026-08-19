import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "Model.js" as Model

Panel {
  id: root
  moduleName: "community.backlog-inbox"
  ipcTarget: "community.backlog-inbox"

  property var inbox: Model.emptyState()
  property bool loading: false
  property string output: ""
  property string errorOutput: ""
  property string lastError: ""
  property int selectedIndex: 0
  property bool refreshTimedOut: false

  readonly property int fetchLimit: 100

  readonly property int refreshIntervalSec: Math.max(60, Math.min(3600,
    Number(setting("refreshIntervalSec", 300)) || 300))
  readonly property int displayLimit: Math.max(1, Math.min(50,
    Number(setting("limit", 10)) || 10))
  readonly property string configuredSpace: String(setting("space", "") || "").trim()
  readonly property string beeExecutable: String(setting("beePath", "") || "").trim() || "bee"
  readonly property var issues: inbox.issues || []

  function refresh() {
    if (fetchProcess.running) return
    output = ""
    errorOutput = ""
    refreshTimedOut = false
    loading = true
    var command = [
      beeExecutable, "issue", "list",
      "--assignee", "@me",
      "--count", String(fetchLimit),
      "--json", "issueKey,summary,status,priority,dueDate"
    ]
    if (configuredSpace !== "") command.push("--space", configuredSpace)
    fetchProcess.command = command
    fetchProcess.running = true
    refreshWatchdog.restart()
  }

  function finishRefresh(exitCode) {
    refreshWatchdog.stop()
    output = String(fetchStdout.text || output || "")
    errorOutput = String(fetchStderr.text || errorOutput || "")
    if (exitCode !== 0) {
      lastError = Model.errorMessage(errorOutput || output)
      loading = false
      return
    }
    var result = Model.parseResponse(output, displayLimit, fetchLimit)
    if (result.ok) {
      inbox = result
      lastError = ""
    } else {
      lastError = errorOutput !== "" ? Model.errorMessage(errorOutput) : result.error
    }
    loading = false
    selectedIndex = Math.min(selectedIndex, Math.max(0, issues.length - 1))
  }

  function openSelected() {
    if (selectedIndex < 0 || selectedIndex >= issues.length) return
    openIssue(issues[selectedIndex])
  }

  function openIssue(issue) {
    var key = String(issue && issue.key ? issue.key : "")
    if (!/^[A-Za-z0-9_]+-[0-9]+$/.test(key)) return
    var command = [beeExecutable, "browse", key]
    if (configuredSpace !== "") command.push("--space", configuredSpace)
    Quickshell.execDetached(command)
  }

  function moveSelection(delta) {
    if (issues.length === 0) return
    selectedIndex = (selectedIndex + delta + issues.length) % issues.length
  }

  onOpenedChanged: if (opened) refresh()
  Component.onDestruction: if (fetchProcess.running) fetchProcess.running = false

  Process {
    id: fetchProcess
    stdout: StdioCollector {
      id: fetchStdout
      waitForEnd: true
      onStreamFinished: root.output = text
    }
    stderr: StdioCollector {
      id: fetchStderr
      waitForEnd: true
      onStreamFinished: root.errorOutput = text
    }
    onExited: function(exitCode) {
      refreshWatchdog.stop()
      if (root.refreshTimedOut) return
      // Let both waitForEnd collectors publish their complete buffers first.
      Qt.callLater(function() { root.finishRefresh(exitCode) })
    }
  }

  Timer {
    id: refreshWatchdog
    interval: 30000
    repeat: false
    onTriggered: {
      if (!root.loading) return
      root.refreshTimedOut = true
      if (fetchProcess.running) fetchProcess.running = false
      root.lastError = "Bee did not respond within 30 seconds"
      root.loading = false
    }
  }

  Timer {
    interval: root.refreshIntervalSec * 1000
    running: true
    repeat: true
    triggeredOnStart: true
    onTriggered: root.refresh()
  }

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: Model.labelFor(root.inbox, root.loading, root.lastError !== "")
    active: root.lastError !== ""
    labelVisible: true
    fixedWidth: vertical ? -1 : Style.space(68)
    fixedHeight: vertical ? Style.bar.iconSlot : -1
    horizontalMargin: Style.space(7)
    tooltipText: root.lastError !== "" ? root.lastError : "Backlog Inbox"
    onPressed: function(b) {
      if (b === Qt.MiddleButton) root.refresh()
      else root.toggle()
    }
  }

  KeyboardPanel {
    id: panel
    anchorItem: button
    owner: root
    bar: root.bar
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(560))
    contentHeight: panel.fittedContentHeight(Math.min(Style.space(520), content.implicitHeight))

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onMoveRequested: function(dx, dy) {
        if (dy !== 0) root.moveSelection(dy)
      }
      onActivateRequested: root.openSelected()
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }
      onTextKey: function(t) {
        if (t === "r" || t === "R") root.refresh()
      }

      Flickable {
        anchors.fill: parent
        contentWidth: width
        contentHeight: content.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds

        Column {
          id: content
          width: parent.width
          spacing: Style.space(10)

          Row {
            width: parent.width
            spacing: Style.space(10)

            Text {
              text: "Backlog Inbox"
              color: root.bar.foreground
              font.family: root.bar.fontFamily
              font.pixelSize: Style.font.heading
              font.bold: true
            }

            Item { width: Math.max(0, parent.width - parent.children[0].implicitWidth - refreshLabel.implicitWidth - parent.spacing * 2); height: 1 }

            Text {
              id: refreshLabel
              text: root.loading ? "Updating…" : "R to refresh"
              color: Qt.darker(root.bar.foreground, 1.4)
              font.family: root.bar.fontFamily
              font.pixelSize: Style.font.caption
            }
          }

          Text {
            visible: root.lastError !== ""
            width: parent.width
            text: (root.issues.length > 0 ? "Refresh failed; showing previous data. " : "") + root.lastError
            color: Color.urgent
            wrapMode: Text.Wrap
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.body
          }

          Text {
            visible: root.inbox.truncated === true
            width: parent.width
            text: "Counted from the latest " + root.fetchLimit
              + " assigned issues; older open issues may be omitted."
            color: Color.urgent
            wrapMode: Text.Wrap
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.caption
          }

          Text {
            visible: !root.loading && root.lastError === "" && root.issues.length === 0
            width: parent.width
            text: "No assigned issues"
            color: root.bar.foreground
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.body
          }

          Repeater {
            model: root.issues

            Rectangle {
              required property var modelData
              required property int index
              width: content.width
              height: issueColumn.implicitHeight + Style.space(18)
              radius: Style.cornerRadius
              color: index === root.selectedIndex
                ? Style.hoverFillFor(root.bar.foreground, Color.accent)
                : "transparent"

              Column {
                id: issueColumn
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.verticalCenter: parent.verticalCenter
                anchors.leftMargin: Style.space(10)
                anchors.rightMargin: Style.space(10)
                spacing: Style.space(3)

                Text {
                  width: parent.width
                  text: String(modelData.key || "") + "  " + String(modelData.summary || "")
                  color: root.bar.foreground
                  font.family: root.bar.fontFamily
                  font.pixelSize: Style.font.body
                  font.bold: true
                  elide: Text.ElideRight
                }

                Text {
                  width: parent.width
                  text: String(modelData.status || "")
                    + (modelData.dueDate ? "  ·  Due " + modelData.dueDate : "")
                  color: Qt.darker(root.bar.foreground, 1.4)
                  font.family: root.bar.fontFamily
                  font.pixelSize: Style.font.caption
                  elide: Text.ElideRight
                }
              }

              MouseArea {
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onEntered: root.selectedIndex = index
                onClicked: root.openIssue(modelData)
              }
            }
          }
        }
      }
    }
  }
}
