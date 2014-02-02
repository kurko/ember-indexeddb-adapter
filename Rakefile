desc "Builds the JS files"
task :build do
  version = File.open("VERSION").read.strip

  files = [
    "packages/indexeddb-adapter/lib/indexeddb_migration.js",
    "packages/indexeddb-adapter/lib/indexeddb_serializer.js",
    "packages/indexeddb-adapter/lib/indexeddb_smartsearch.js",
    "packages/indexeddb-adapter/lib/indexeddb_adapter.js"
  ]

  code = files.map { |file| File.open(file).read }

  FileUtils.mkdir_p("dist")
  file = File.new("dist/ember_indexeddb_adapter_#{version}.js", "w+")
  file.write(code.join("\n"))
  file.close

  puts "Build complete."
end
