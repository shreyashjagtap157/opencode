type Definition = {
  [method: string]: (input: unknown) => unknown
}

export function listen(rpc: Definition) {
  onmessage = async (evt) => {
    const parsed = JSON.parse(evt.data) as { type: string; method: string; input: unknown; id: number }
    if (parsed.type === "rpc.request") {
      const result = await rpc[parsed.method](parsed.input)
      postMessage(JSON.stringify({ type: "rpc.result", result, id: parsed.id }))
    }
  }
}

export function emit(event: string, data: unknown) {
  postMessage(JSON.stringify({ type: "rpc.event", event, data }))
}

export function client<T extends Definition>(target: {
  postMessage: (data: string) => void | null
  onmessage: ((this: Worker, ev: MessageEvent) => void) | null
}) {
  const pending = new Map<number, (result: unknown) => void>()
  const listeners = new Map<string, Set<(data: unknown) => void>>()
  let id = 0
  target.onmessage = async (evt) => {
    const parsed = JSON.parse(evt.data) as { type: string; event: string; data: unknown; result: unknown; id: number }
    if (parsed.type === "rpc.result") {
      const resolve = pending.get(parsed.id)
      if (resolve) {
        resolve(parsed.result)
        pending.delete(parsed.id)
      }
    }
    if (parsed.type === "rpc.event") {
      const handlers = listeners.get(parsed.event)
      if (handlers) {
        for (const handler of handlers) {
          handler(parsed.data)
        }
      }
    }
  }
  return {
    call<Method extends keyof T>(method: Method, input: Parameters<T[Method]>[0]): Promise<ReturnType<T[Method]>> {
      const requestId = id++
      return new Promise((resolve) => {
        pending.set(requestId, resolve as (result: unknown) => void)
        target.postMessage(JSON.stringify({ type: "rpc.request", method, input, id: requestId }))
      })
    },
    on<Data>(event: string, handler: (data: Data) => void) {
      let handlers = listeners.get(event)
      if (!handlers) {
        handlers = new Set()
        listeners.set(event, handlers)
      }
      handlers.add(handler)
      return () => {
        handlers!.delete(handler as (data: unknown) => void)
      }
    },
  }
}

export * as Rpc from "./rpc"
