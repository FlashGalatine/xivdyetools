using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
  services = [
    (name = "caller", worker = (modules = [(name = "c.js", esModule = embed "caller.js")], compatibilityDate = "2024-12-01", bindings = [(name = "SVC", service = "callee")])),
    (name = "callee", worker = (modules = [(name = "e.js", esModule = embed "callee.js")], compatibilityDate = "2024-12-01")),
  ],
  sockets = [(name = "http", address = "127.0.0.1:18787", http = (), service = "caller")]
);
