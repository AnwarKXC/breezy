import { spawn } from 'node:child_process'
import path from 'node:path'
import { SCRIPT_DIR, hasFlag } from './shared.mjs'

function run(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(SCRIPT_DIR, script), ...args], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    let output = ''
    child.stdout.on('data', (chunk) => {
      output += chunk
      process.stdout.write(chunk)
    })
    child.on('exit', (code) => {
      if (code === 0) resolve(output)
      else reject(new Error(`${script} exited with code ${code}`))
    })
  })
}

function parseFile(output) {
  const jsonStart = output.indexOf('{')
  if (jsonStart < 0) throw new Error('Could not find JSON output from migration step')
  return JSON.parse(output.slice(jsonStart)).file
}

const apply = hasFlag('--apply')
const exportFile = parseFile(await run('export-firebase.mjs'))
const transformedFile = parseFile(await run('transform.mjs', [`--input=${exportFile}`]))
await run('import-supabase.mjs', [`--input=${transformedFile}`, ...(apply ? ['--apply'] : [])])
