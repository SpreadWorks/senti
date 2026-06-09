<?php

namespace App;

/**
 * HTTP client wrapper for making outbound requests.
 */
class HttpClient
{
    private Config $config;
    private int $timeout;
    private array $defaultHeaders;

    public function __construct(Config $config)
    {
        $this->config = $config;
        $this->timeout = $config->get('http.timeout', 30);
        $this->defaultHeaders = [
            'User-Agent' => 'MyApp/1.0',
            'Accept' => 'application/json',
        ];
    }

    /**
     * Send a GET request.
     *
     * @param string $url
     * @param array $headers
     * @return string Response body
     */
    public function get(string $url, array $headers = []): string
    {
        return $this->request('GET', $url, null, $headers);
    }

    /**
     * Send a POST request with a body.
     *
     * @param string $url
     * @param string|null $body
     * @param array $headers
     * @return string Response body
     */
    public function post(string $url, ?string $body = null, array $headers = []): string
    {
        return $this->request('POST', $url, $body, $headers);
    }

    /**
     * Send an HTTP request using the specified method.
     *
     * @param string $method
     * @param string $url
     * @param string|null $body
     * @param array $headers
     * @return string Response body
     * @throws \RuntimeException on request failure
     */
    public function request(string $method, string $url, ?string $body = null, array $headers = []): string
    {
        $mergedHeaders = array_merge($this->defaultHeaders, $headers);

        $headerLines = [];
        foreach ($mergedHeaders as $name => $value) {
            $headerLines[] = "{$name}: {$value}";
        }

        $context = stream_context_create([
            'http' => [
                'method' => $method,
                'header' => implode("\r\n", $headerLines),
                'content' => $body,
                'timeout' => $this->timeout,
                'ignore_errors' => true,
            ],
        ]);

        $result = file_get_contents($url, false, $context);

        if ($result === false) {
            throw new \RuntimeException("HTTP request failed: {$method} {$url}");
        }

        return $result;
    }
}
