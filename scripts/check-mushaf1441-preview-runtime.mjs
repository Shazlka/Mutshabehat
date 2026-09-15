import { existsSync, readFileSync } from 'node:fs'

function fail(message) {
  console.error(`Mushaf 1441 preview runtime check failed: ${message}`)
  process.exit(1)
}

if (!existsSync('.nvmrc')) {
  fail('.nvmrc is missing; use Node 22 for local preview')
}

const requestedNode = readFileSync('.nvmrc', 'utf8').trim()
if (requestedNode !== '22') {
  fail(`.nvmrc must pin Node 22, found ${requestedNode}`)
}

const major = Number(process.versions.node.split('.')[0])
if (major !== 22) {
  fail(`current Node is ${process.versions.node}; run the preview with Node 22 before starting next dev`)
}

console.log('Mushaf 1441 preview runtime check passed.')
