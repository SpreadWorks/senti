<?php

namespace App;

/**
 * Simple logger that writes formatted messages to a file or stdout.
 */
class Logger
{
    private string $level;
    private string $output;

    private const LEVELS = ['debug' => 0, 'info' => 1, 'warning' => 2, 'error' => 3];

    public function __construct(string $level = 'info', string $output = 'php://stdout')
    {
        $this->level = $level;
        $this->output = $output;
    }

    /**
     * Log an informational message.
     *
     * @param string $message
     * @param array $context
     * @return void
     */
    public function log(string $message, array $context = []): void
    {
        $this->write('info', $message, $context);
    }

    /**
     * Log an error message.
     *
     * @param string $message
     * @param array $context
     * @return void
     */
    public function error(string $message, array $context = []): void
    {
        $this->write('error', $message, $context);
    }

    /**
     * Log a warning message.
     *
     * @param string $message
     * @param array $context
     * @return void
     */
    public function warning(string $message, array $context = []): void
    {
        $this->write('warning', $message, $context);
    }

    /**
     * Write a log entry if the level meets the threshold.
     *
     * @param string $level
     * @param string $message
     * @param array $context
     * @return void
     */
    private function write(string $level, string $message, array $context): void
    {
        if ((self::LEVELS[$level] ?? 0) < (self::LEVELS[$this->level] ?? 0)) {
            return;
        }

        $timestamp = date('Y-m-d H:i:s');
        $formatted = "[{$timestamp}] [{$level}] {$message}";

        if (!empty($context)) {
            $formatted .= ' ' . json_encode($context);
        }

        file_put_contents($this->output, $formatted . PHP_EOL, FILE_APPEND);
    }
}
