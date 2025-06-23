import { useState, useCallback, useEffect } from 'react';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import { loadLogicResultsFromDB } from '@/app/tests/tool-generation-workbench/components/tool-tester-core-logic';
import { loadAllToolsFromDB, loadV2JobsFromDB, loadToolsFromDynamoDB } from '../../ui/db-utils';
import { ModelOption } from '../components/tool-tester-parts/tool-tester-types';
import { type BrainstormResult } from '../types/unified-brainstorm-types';
import DEFAULT_MODELS from '@/lib/ai/models/default-models.json';

export const useToolTesterData = (newBrainstormFlag?: number, userId?: string) => {
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [defaultPrimaryModel, setDefaultPrimaryModel] = useState<string | null>(null);
  const [savedBrainstorms, setSavedBrainstorms] = useState<BrainstormResult[]>([]);
  const [savedTools, setSavedTools] = useState<ProductToolDefinition[]>([]);
  const [savedV2Jobs, setSavedV2Jobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dynamoDBTools, setDynamoDBTools] = useState<ProductToolDefinition[]>([]);
  const [loadSource, setLoadSource] = useState<'indexeddb' | 'dynamodb'>('indexeddb');

  const fetchDefaultModel = useCallback(async () => {
    console.log('🎯 fetchDefaultModel: Starting default model fetch...');
    try {
      const response = await fetch('/api/ai/logic-architect/brainstorm'); 
      if (response.ok) {
        const data = await response.json();
        console.log('🎯 Default model API response:', data);
        if (data.success && data.defaultModel?.primary?.id) {
          console.log('✅ Setting default primary model:', data.defaultModel.primary.id);
          setDefaultPrimaryModel(data.defaultModel.primary.id);
        } else if (data.defaultPrimaryModel) {
          console.log('✅ Setting default primary model (fallback):', data.defaultPrimaryModel);
          setDefaultPrimaryModel(data.defaultPrimaryModel);
        } else {
          console.warn('⚠️ No valid default model in response, using fallback');
          setDefaultPrimaryModel('claude-3-7-sonnet-20250219');
        }
      } else {
        console.error('❌ Default model API request failed:', response.status);
        setDefaultPrimaryModel('claude-3-7-sonnet-20250219');
      }
    } catch (error) {
      console.warn('Failed to fetch default model, using fallback:', error);
      setDefaultPrimaryModel('claude-3-7-sonnet-20250219');
    }
  }, []);

  const fetchModels = useCallback(() => {
    console.log('📋 fetchModels: Starting model parsing...');
    try {
      const parsedModels: ModelOption[] = [];
      if (!DEFAULT_MODELS?.providers) {
        console.error('❌ DEFAULT_MODELS.providers is missing');
        setError('DEFAULT_MODELS data is not properly loaded.');
        return;
      }
      
      console.log('📋 Available providers:', Object.keys(DEFAULT_MODELS.providers));
      
      for (const providerKey in DEFAULT_MODELS.providers) {
        const provider = (DEFAULT_MODELS.providers as any)[providerKey];
        if (!provider?.models) {
          console.warn(`⚠️ Provider ${providerKey} has no models`);
          continue;
        }
        
        for (const modelKey in provider.models) {
          const model = (provider.models as any)[modelKey];
          if (model.deprecated === true || !model.id || !model.name) continue;
          
          parsedModels.push({ 
            id: model.id, 
            name: `${model.name} (${provider.name})`,
            provider: provider.name
          });
        }
      }
      
      console.log(`📋 Parsed ${parsedModels.length} models:`, parsedModels.slice(0, 3));
      
      if (parsedModels.length === 0) {
        setError('No AI models were found in the configuration.');
      } else {
        setAvailableModels(parsedModels);
      }
    } catch (err) {
      const typedErr = err as Error;
      console.error('Failed to parse models:', typedErr);
      setError(`Failed to load AI models: ${typedErr.message}`);
    }
  }, []);

  const fetchBrainstorms = useCallback(async () => {
    try {
      setIsLoading(true);
      const results = await loadLogicResultsFromDB();
      setSavedBrainstorms(results);
      setError(null);
    } catch (err) {
      const typedErr = err as Error;
      console.error('Failed to load saved brainstorms:', typedErr);
      setError(`Failed to load saved brainstorms: ${typedErr.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSavedTools = useCallback(async () => {
    try {
      const tools = await loadAllToolsFromDB(userId);
      setSavedTools(tools);
    } catch (err) {
        const typedErr = err as Error;
      console.error('Failed to load saved tools:', typedErr);
      setError(`Failed to load saved tools: ${typedErr.message}`);
    }
  }, [userId]);

  const fetchSavedV2Jobs = useCallback(async () => {
    try {
      const jobs = await loadV2JobsFromDB();
      setSavedV2Jobs(jobs);
    } catch (err) {
      const typedErr = err as Error;
      console.error('Failed to load saved V2 jobs:', typedErr);
      setError(`Failed to load saved V2 jobs: ${typedErr.message}`);
    }
  }, []);

  useEffect(() => {
    console.log('📡 useToolTesterData: Fetching models and default model...');
    fetchDefaultModel();
    fetchModels();
  }, []); // Remove dependencies to avoid infinite loops

  const fetchDynamoDBTools = useCallback(async () => {
    console.log('Fetching tools from DynamoDB...');
    setIsLoading(true);
    try {
        const tools = await loadToolsFromDynamoDB();
        setDynamoDBTools(tools);
        console.log(`Fetched ${tools.length} tools from DynamoDB.`);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        setError(`Failed to load tools from DynamoDB: ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBrainstorms();
    fetchSavedTools();
    fetchSavedV2Jobs();
    fetchDynamoDBTools();
  }, [newBrainstormFlag, fetchBrainstorms, fetchSavedTools, fetchSavedV2Jobs, fetchDynamoDBTools]);

  return {
    availableModels,
    defaultPrimaryModel,
    savedBrainstorms,
    setSavedBrainstorms,
    savedTools,
    setSavedTools,
    savedV2Jobs,
    setSavedV2Jobs,
    isLoading,
    error,
    setError,
    fetchSavedTools,
    fetchSavedV2Jobs,
    dynamoDBTools,
    loadSource,
    setLoadSource,
  };
};