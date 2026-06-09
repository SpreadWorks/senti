<?php

namespace App;

/**
 * Main application class that bootstraps configuration,
 * sets up services, and handles incoming requests.
 */
class App
{
    /** @var Config */
    private Config $config;

    /** @var Logger */
    private Logger $logger;

    /** @var HttpClient */
    private HttpClient $httpClient;

    /** @var bool */
    private bool $booted = false;

    public function __construct(string $configPath = 'config.json')
    {
        $this->config = new Config();
        $this->config->load($configPath);
        $this->logger = new Logger($this->config->get('log.level', 'info'));
        $this->httpClient = new HttpClient($this->config);
    }

    /**
     * Run the application main loop.
     *
     * @return int Exit code
     */
    public function run(): int
    {
        $this->configure();
        $this->logger->log('Application started');

        try {
            $request = $this->parseRequest();
            $response = $this->handleRequest($request);
            echo $response;
            return 0;
        } catch (\Throwable $e) {
            $this->logger->error('Unhandled exception: ' . $e->getMessage());
            return 1;
        }
    }

    /**
     * Configure application services and middleware.
     *
     * @return void
     */
    public function configure(): void
    {
        if ($this->booted) {
            return;
        }

        $logFile = $this->config->get('log.file', 'app.log');
        $this->logger->log("Logging to {$logFile}");

        $timeout = $this->config->get('http.timeout', 30);
        $this->httpClient = new HttpClient($this->config);

        $this->booted = true;
    }

    /**
     * Handle an incoming request and return a response string.
     *
     * @param array $request Parsed request data
     * @return string Response body
     */
    public function handleRequest(array $request): string
    {
        $method = $request['method'] ?? 'GET';
        $path = $request['path'] ?? '/';

        $this->logger->log("Handling {$method} {$path}");

        if ($path === '/health') {
            return json_encode(['status' => 'ok']);
        }

        if ($path === '/proxy' && isset($request['url'])) {
            $response = $this->httpClient->get($request['url']);
            return $response;
        }

        return json_encode(['error' => 'Not Found']);
    }

    /**
     * Parse the current request from globals.
     *
     * @return array
     */
    private function parseRequest(): array
    {
        return [
            'method' => $_SERVER['REQUEST_METHOD'] ?? 'GET',
            'path' => parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH),
            'query' => $_GET ?? [],
            'body' => file_get_contents('php://input') ?: '',
        ];
    }
}
