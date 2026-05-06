import { createClient } from './supabase-browser';
import { createBrowserClient } from '@supabase/ssr';

// 1. Mock the external Supabase dependency
jest.mock('@supabase/ssr', () => ({
  createBrowserClient: jest.fn(),
}));

describe('Supabase Browser Client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // 2. Reset env vars and mocks before each test to prevent leakage
    jest.resetModules();
    process.env = { ...originalEnv };
    (createBrowserClient as jest.Mock).mockClear();
  });

  afterAll(() => {
    // Restore original env vars after the suite finishes
    process.env = originalEnv;
  });

  it('should initialize the client using the correct environment variables', () => {
    // Arrange
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock-project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key';

    // Act
    createClient();

    // Assert
    expect(createBrowserClient).toHaveBeenCalledTimes(1);
    expect(createBrowserClient).toHaveBeenCalledWith(
      'https://mock-project.supabase.co',
      'mock-anon-key'
    );
  });

  it('should return the client instance created by createBrowserClient', () => {
    // Arrange
    const mockSupabaseInstance = { auth: { getSession: jest.fn() } };
    (createBrowserClient as jest.Mock).mockReturnValue(mockSupabaseInstance);

    // Act
    const result = createClient();

    // Assert
    expect(result).toBe(mockSupabaseInstance);
  });

  it('should pass undefined if environment variables are missing', () => {
    // Arrange (simulating a misconfigured environment)
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Act
    createClient();

    // Assert
    expect(createBrowserClient).toHaveBeenCalledWith(undefined, undefined);
  });
});