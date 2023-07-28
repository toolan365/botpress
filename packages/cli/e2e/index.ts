import { Logger } from '@bpinternal/log4bot'
import yargs, { YargsConfig, YargsSchema } from '@bpinternal/yargs-extra'
import * as consts from '../src/consts'
import { createDeployBot } from './tests/create-deploy-bot'
import { createDeployIntegration } from './tests/create-deploy-integration'
import { devBot } from './tests/dev-bot'
import { Test } from './typings'
import { sleep, TmpDirectory } from './utils'

const tests: Test[] = [createDeployBot, createDeployIntegration, devBot]

const timeout = (ms: number) =>
  sleep(ms).then(() => {
    throw new Error(`Timeout after ${ms}ms`)
  })

const TIMEOUT = 20_000

const configSchema = {
  timeout: {
    type: 'number',
    default: TIMEOUT,
  },
  verbose: {
    type: 'boolean',
    default: false,
    alias: 'v',
  },
  filter: {
    type: 'string',
  },
  workspaceId: {
    type: 'string',
    demandOption: true,
  },
  token: {
    type: 'string',
    demandOption: true,
  },
  apiUrl: {
    type: 'string',
    default: consts.defaultBotpressApiUrl,
  },
  tunnelUrl: {
    type: 'string',
    default: consts.defaultTunnelUrl,
  },
} satisfies YargsSchema

const main = async (argv: YargsConfig<typeof configSchema>): Promise<never> => {
  const logger = new Logger('e2e', { level: argv.verbose ? 'debug' : 'info' })

  const filterRegex = argv.filter ? new RegExp(argv.filter) : null
  const filteredTests = tests.filter(({ name }) => (filterRegex ? filterRegex.test(name) : true))
  logger.info(`Running ${filteredTests.length} / ${tests.length} tests`)

  for (const { name, handler } of filteredTests) {
    const logLine = `### Running test: "${name}" ###`
    const logPad = '#'.repeat(logLine.length)
    logger.info(logPad)
    logger.info(logLine)
    logger.info(logPad + '\n')

    const tmpDir = TmpDirectory.create()
    try {
      const t0 = Date.now()
      await Promise.race([handler({ tmpDir: tmpDir.path, ...argv }), timeout(argv.timeout)])
      const t1 = Date.now()
      logger.info(`SUCCESS: "${name}" (${t1 - t0}ms)`)
    } catch (thrown) {
      const err = thrown instanceof Error ? thrown : new Error(`${thrown}`)
      logger.attachError(err).error(`FAILURE: "${name}"`)
      process.exit(1)
    } finally {
      tmpDir.cleanup()
    }
  }

  logger.info('All tests passed')
  process.exit(0)
}

void yargs.command('$0', 'Run E2E Tests', configSchema, main).parse()