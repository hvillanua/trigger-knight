const gate = process.argv[2];

process.stdout.write(`fixture stdout: ${gate}\n`);
process.stderr.write(`fixture stderr: ${gate}\n`);

if (process.env.VALIDATION_FIXTURE_FAILURE === gate) {
  process.exitCode = 7;
}
