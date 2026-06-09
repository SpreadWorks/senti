<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\ThreadController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => redirect('/threads'));

Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
Route::post('/login', [AuthController::class, 'login']);
Route::get('/register', [AuthController::class, 'showRegister'])->name('register');
Route::post('/register', [AuthController::class, 'register']);
Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

Route::middleware('auth')->group(function () {
    Route::resource('threads', ThreadController::class);
    Route::resource('threads.posts', PostController::class)->only(['store', 'edit', 'update', 'destroy']);
});
