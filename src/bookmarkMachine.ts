import { createMachine, assign } from "xstate"
import { Uri } from "vscode"
import { TrompConfig } from "./types/trompSchema"

export interface BookmarkContext {
  workspace: Uri | undefined
  config: TrompConfig | undefined
}

export type BookmarkEvent =
  | { type: "OPEN_BOOKMARK" }
  | { type: "EDIT" }
  | { type: "DISMISS" }

export type BookmarkState =
  | {
      value: "initial"
      context: BookmarkContext & { workspace: undefined; config: undefined }
    }
  | {
      value: "configured"
      context: BookmarkContext & { workspace: Uri; config: TrompConfig }
    }
  | {
      value: "bookmarkList"
      context: BookmarkContext & { workspace: Uri; config: TrompConfig }
    }
  | {
      value: "noBookmarks"
      context: BookmarkContext & { workspace: Uri; config: TrompConfig }
    }
  | { value: "complete"; context: BookmarkContext }

export const bookmarkMachine = createMachine<
  BookmarkContext,
  BookmarkEvent,
  BookmarkState
>({
  id: "bookmark",
  context: {
    config: undefined,
    workspace: undefined,
  },
  initial: "initial",
  states: {
    initial: {
      invoke: {
        src: "configMachine",
        onDone: [
          {
            target: "configured",
            cond: (_context, event) => {
              return !!(event.data.config && event.data.workspace)
            },
            actions: assign({
              config: (_context, event) => event.data.config,
              workspace: (_context, event) => event.data.workspace,
            }),
          },
          {
            target: "complete",
          },
        ],
      },
    },
    configured: {
      on: {
        "": [
          {
            target: "bookmarkList",
            cond: context => {
              const bookmarks = context.config!.bookmarks! // todo: better types?
              return Object.keys(bookmarks).length > 0
            },
          },
          {
            target: "noBookmarks",
          },
        ],
      },
    },
    bookmarkList: {
      invoke: {
        src: "renderBookmarkList",
        onDone: "complete",
      },
    },
    noBookmarks: {
      invoke: {
        src: "renderNoBookmarks",
      },
      on: {
        EDIT: {
          target: "complete",
          actions: "EDIT_CONFIG",
        },
        DISMISS: "complete",
      },
    },
    complete: {
      type: "final",
    },
  },
})
