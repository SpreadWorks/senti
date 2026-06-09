<?php

use App\Http\Controllers\TagController;
use App\Http\Controllers\ThreadController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::apiResource('threads', ThreadController::class);
    Route::apiResource('tags', TagController::class);
});
