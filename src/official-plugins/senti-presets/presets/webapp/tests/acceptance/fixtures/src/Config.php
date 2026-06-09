<?php

namespace App;

/**
 * Configuration manager that loads JSON config files
 * and provides dot-notation access to values.
 */
class Config
{
    /** @var array */
    private array $data = [];

    /**
     * Load configuration from a JSON file.
     *
     * @param string $path Path to the JSON config file
     * @return void
     * @throws \RuntimeException if file cannot be read or parsed
     */
    public function load(string $path): void
    {
        if (!file_exists($path)) {
            throw new \RuntimeException("Config file not found: {$path}");
        }

        $contents = file_get_contents($path);
        $decoded = json_decode($contents, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \RuntimeException('Failed to parse config: ' . json_last_error_msg());
        }

        $this->data = array_merge($this->data, $decoded);
    }

    /**
     * Get a configuration value using dot notation.
     *
     * @param string $key Dot-separated key path (e.g. "log.level")
     * @param mixed $default Default value if key is not found
     * @return mixed
     */
    public function get(string $key, mixed $default = null): mixed
    {
        $segments = explode('.', $key);
        $current = $this->data;

        foreach ($segments as $segment) {
            if (!is_array($current) || !array_key_exists($segment, $current)) {
                return $default;
            }
            $current = $current[$segment];
        }

        return $current;
    }

    /**
     * Set a configuration value using dot notation.
     *
     * @param string $key Dot-separated key path
     * @param mixed $value
     * @return void
     */
    public function set(string $key, mixed $value): void
    {
        $segments = explode('.', $key);
        $current = &$this->data;

        foreach ($segments as $i => $segment) {
            if ($i === count($segments) - 1) {
                $current[$segment] = $value;
            } else {
                if (!isset($current[$segment]) || !is_array($current[$segment])) {
                    $current[$segment] = [];
                }
                $current = &$current[$segment];
            }
        }
    }
}
