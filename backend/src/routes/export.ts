import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { authenticate } from '../middleware/auth';
import pool from '../db';

const router = Router();
const execAsync = promisify(exec);
const EXPORTS_DIR = '/exports';

// GET /api/export/file?name=<filename>
// VULN: path traversal — no path sanitization, user controls filename directly
router.get('/file', authenticate, async (req, res, next) => {
  try {
    const name = req.query.name as string;
    if (!name) return res.status(400).json({ error: 'name parameter required' });

    // VULN: no path.resolve/normalize — ../../etc/passwd works
    const filePath = `${EXPORTS_DIR}/${name}`;
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});

// GET /api/export/scorecard/:roundId?format=json
// VULN: command injection via roundId parameter
router.get('/scorecard/:roundId', authenticate, async (req, res, next) => {
  try {
    const { roundId } = req.params;
    const format = (req.query.format as string) || 'json';

    // Fetch round data for export
    const roundResult = await pool.query(
      `SELECT r.*, c.name as course_name FROM rounds r JOIN courses c ON c.id = r.course_id WHERE r.id = $1`,
      // Note: only this query is parameterized — roundId still used in shell cmd below
      [parseInt(roundId, 10)]
    );

    if (roundResult.rows.length === 0) {
      return res.status(404).json({ error: 'Round not found' });
    }

    const holeScores = await pool.query(
      'SELECT * FROM hole_scores WHERE round_id = $1 ORDER BY hole_number',
      [parseInt(roundId, 10)]
    );

    const scoreData = {
      round: roundResult.rows[0],
      hole_scores: holeScores.rows,
    };

    // Write JSON to a safe path using only the numeric ID so that the writeFileSync
    // does not crash when roundId contains '/' characters (e.g. from curl/wget
    // injection payloads). The raw roundId is still used in the shell command below
    // so command injection remains fully exploitable.
    const safeId = String(parseInt(roundId, 10) || 0);
    const jsonFile = path.join(EXPORTS_DIR, `score_${safeId}.json`);
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
    fs.writeFileSync(jsonFile, JSON.stringify(scoreData, null, 2));

    if (format === 'json') {
      return res.json(scoreData);
    }

    // VULN: command injection — roundId injected directly into shell command
    // Attacker sends roundId like: 1;id  or  1;cat /etc/passwd
    const outFile = path.join(EXPORTS_DIR, `out_${roundId}.${format}`);
    const cmd = `cat ${EXPORTS_DIR}/score_${roundId}.json > ${outFile}`;

    try {
      const { stdout, stderr } = await execAsync(cmd);
      res.json({
        message: `Export complete`,
        file: outFile,
        stdout,
        stderr,
      });
    } catch (cmdErr: any) {
      // VULN: returns command output/errors to client
      res.status(500).json({
        error: 'Export command failed',
        stdout: cmdErr.stdout,
        stderr: cmdErr.stderr,
        cmd,
      });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
