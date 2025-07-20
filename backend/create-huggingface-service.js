const fs = require('fs').promises;
const path = require('path');

async function createHuggingFaceService() {
  console.log('=== Creating Hugging Face Resume Enhancement Service ===\n');
  
  const serviceCode = `
const axios = require('axios');

class HuggingFaceResumeService {
  constructor() {
    this.apiKey = process.env.HUGGINGFACE_API_KEY;
    this.baseURL = 'https://api-inference.huggingface.co/models/';
    
    // We'll use multiple models for different tasks
    this.models = {
      // Token classification for identifying entities
      tokenClassification: 'dslim/bert-base-NER',
      
      // Zero-shot classification for categorizing skills
      zeroShot: 'facebook/bart-large-mnli',
      
      // Text generation for expanding abbreviations
      textGeneration: 'gpt2',
      
      // Sentence similarity for finding related skills
      sentenceSimilarity: 'sentence-transformers/all-MiniLM-L6-v2'
    };
  }

  async callHuggingFaceAPI(modelName, inputs, options = {}) {
    try {
      const response = await axios.post(
        this.baseURL + modelName,
        { inputs, ...options },
        {
          headers: {
            'Authorization': \`Bearer \${this.apiKey}\`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error(\`Hugging Face API error for \${modelName}:\`, error.message);
      
      // If model is loading, wait and retry
      if (error.response?.status === 503) {
        console.log('Model is loading, waiting 20 seconds...');
        await new Promise(resolve => setTimeout(resolve, 20000));
        return this.callHuggingFaceAPI(modelName, inputs, options);
      }
      
      throw error;
    }
  }

  // Extract named entities (people, organizations, locations)
  async extractEntities(text) {
    console.log('Extracting named entities from text...');
    
    try {
      const results = await this.callHuggingFaceAPI(
        this.models.tokenClassification,
        text
      );
      
      // Group entities by type
      const entities = {
        persons: [],
        organizations: [],
        locations: [],
        misc: []
      };
      
      results.forEach(entity => {
        const entityText = entity.word.replace(/##/g, '');
        
        switch(entity.entity_group) {
          case 'PER':
            entities.persons.push({
              text: entityText,
              score: entity.score
            });
            break;
          case 'ORG':
            entities.organizations.push({
              text: entityText,
              score: entity.score
            });
            break;
          case 'LOC':
            entities.locations.push({
              text: entityText,
              score: entity.score
            });
            break;
          default:
            entities.misc.push({
              text: entityText,
              type: entity.entity_group,
              score: entity.score
            });
        }
      });
      
      return entities;
    } catch (error) {
      console.error('Entity extraction failed:', error);
      return null;
    }
  }

  // Categorize skills into technical categories
  async categorizeSkills(skills) {
    console.log('Categorizing skills using zero-shot classification...');
    
    const categories = [
      'Frontend Development',
      'Backend Development',
      'Database',
      'DevOps',
      'Mobile Development',
      'Data Science',
      'Cloud Computing',
      'Programming Language'
    ];
    
    const categorizedSkills = [];
    
    for (const skill of skills) {
      try {
        const result = await this.callHuggingFaceAPI(
          this.models.zeroShot,
          skill,
          {
            parameters: {
              candidate_labels: categories,
              multi_label: true
            }
          }
        );
        
        // Take top 2 categories with confidence > 0.3
        const topCategories = result.labels
          .map((label, index) => ({
            category: label,
            score: result.scores[index]
          }))
          .filter(cat => cat.score > 0.3)
          .slice(0, 2);
        
        categorizedSkills.push({
          skill,
          categories: topCategories
        });
      } catch (error) {
        console.error(\`Failed to categorize skill "\${skill}":\`, error);
        categorizedSkills.push({
          skill,
          categories: []
        });
      }
    }
    
    return categorizedSkills;
  }

  // Infer experience level from resume text
  async inferExperienceLevel(text) {
    console.log('Inferring experience level from resume content...');
    
    const experienceLevels = ['Entry Level', 'Junior', 'Mid-Level', 'Senior', 'Lead/Principal'];
    
    // Create a prompt that helps classify experience
    const classificationText = \`Resume content: \${text.substring(0, 500)}...\`;
    
    try {
      const result = await this.callHuggingFaceAPI(
        this.models.zeroShot,
        classificationText,
        {
          parameters: {
            candidate_labels: experienceLevels,
            hypothesis_template: 'This person is a {} developer'
          }
        }
      );
      
      return {
        level: result.labels[0],
        confidence: result.scores[0],
        allScores: result.labels.map((label, index) => ({
          level: label,
          score: result.scores[index]
        }))
      };
    } catch (error) {
      console.error('Experience level inference failed:', error);
      return null;
    }
  }

  // Find related skills based on mentioned skills
  async findRelatedSkills(skills) {
    console.log('Finding related skills...');
    
    // Common skill relationships
    const skillRelationships = {
      'React': ['Redux', 'Next.js', 'TypeScript', 'JavaScript', 'Webpack'],
      'Node.js': ['Express.js', 'MongoDB', 'PostgreSQL', 'TypeScript', 'REST APIs'],
      'Python': ['Django', 'Flask', 'NumPy', 'Pandas', 'TensorFlow'],
      'Ruby on Rails': ['Ruby', 'PostgreSQL', 'Redis', 'Sidekiq', 'RSpec'],
      'JavaScript': ['TypeScript', 'ES6+', 'npm', 'Webpack', 'Babel']
    };
    
    const relatedSkills = new Set();
    
    skills.forEach(skill => {
      const normalized = skill.trim().toLowerCase();
      
      Object.keys(skillRelationships).forEach(key => {
        if (normalized.includes(key.toLowerCase())) {
          skillRelationships[key].forEach(related => {
            if (!skills.some(s => s.toLowerCase().includes(related.toLowerCase()))) {
              relatedSkills.add(related);
            }
          });
        }
      });
    });
    
    return Array.from(relatedSkills);
  }

  // Main enhancement function that orchestrates all capabilities
  async enhanceResumeData(originalParsedData, transcriptionText) {
    console.log('Starting Hugging Face resume enhancement...');
    
    const enhanced = {
      ...originalParsedData,
      huggingFaceEnhancement: {
        processedAt: new Date().toISOString(),
        version: '1.0'
      }
    };
    
    try {
      // 1. Extract entities to improve name/organization detection
      const entities = await this.extractEntities(transcriptionText);
      if (entities) {
        enhanced.huggingFaceEnhancement.entities = entities;
        
        // If we found a person name with high confidence, it might be more accurate
        if (entities.persons.length > 0 && entities.persons[0].score > 0.9) {
          enhanced.nameConfidence = entities.persons[0].score;
        }
        
        // Add detected organizations as potential employers/schools
        enhanced.detectedOrganizations = entities.organizations;
      }
      
      // 2. Categorize existing skills
      if (originalParsedData.skills && originalParsedData.skills.length > 0) {
        const categorizedSkills = await this.categorizeSkills(originalParsedData.skills);
        enhanced.huggingFaceEnhancement.categorizedSkills = categorizedSkills;
        
        // Create skill summary
        const skillCategories = {};
        categorizedSkills.forEach(item => {
          item.categories.forEach(cat => {
            if (!skillCategories[cat.category]) {
              skillCategories[cat.category] = [];
            }
            skillCategories[cat.category].push(item.skill);
          });
        });
        enhanced.skillsByCategory = skillCategories;
      }
      
      // 3. Infer experience level
      const experienceLevel = await this.inferExperienceLevel(transcriptionText);
      if (experienceLevel) {
        enhanced.experienceLevel = experienceLevel.level;
        enhanced.experienceLevelConfidence = experienceLevel.confidence;
        enhanced.huggingFaceEnhancement.experienceLevelAnalysis = experienceLevel;
      }
      
      // 4. Suggest related skills
      if (originalParsedData.skills && originalParsedData.skills.length > 0) {
        const related = await this.findRelatedSkills(originalParsedData.skills);
        enhanced.suggestedSkills = related;
      }
      
      // 5. Calculate completeness score
      const completenessScore = this.calculateCompletenessScore(enhanced);
      enhanced.completenessScore = completenessScore;
      
      // 6. Generate improvement suggestions
      enhanced.improvementSuggestions = this.generateImprovementSuggestions(enhanced);
      
      return enhanced;
      
    } catch (error) {
      console.error('Enhancement failed:', error);
      
      // Return original data with error flag
      return {
        ...originalParsedData,
        huggingFaceEnhancement: {
          error: error.message,
          processedAt: new Date().toISOString()
        }
      };
    }
  }
  
  calculateCompletenessScore(resumeData) {
    const requiredFields = ['name', 'email', 'phone', 'skills', 'experience', 'education'];
    const presentFields = requiredFields.filter(field => 
      resumeData[field] && 
      (Array.isArray(resumeData[field]) ? resumeData[field].length > 0 : resumeData[field].length > 0)
    );
    
    return {
      score: (presentFields.length / requiredFields.length) * 100,
      missingFields: requiredFields.filter(field => !presentFields.includes(field)),
      presentFields
    };
  }
  
  generateImprovementSuggestions(resumeData) {
    const suggestions = [];
    
    if (!resumeData.email || resumeData.email.includes(' at ')) {
      suggestions.push('Provide email in standard format (user@domain.com)');
    }
    
    if (!resumeData.experience || resumeData.experience.length < 50) {
      suggestions.push('Add more detail about your work experience');
    }
    
    if (resumeData.skills && resumeData.skills.length < 5) {
      suggestions.push('Mention more technical skills relevant to your field');
    }
    
    if (!resumeData.education || resumeData.education.length < 20) {
      suggestions.push('Include degree, major, and graduation year for education');
    }
    
    if (resumeData.experienceLevel === 'Entry Level' && !resumeData.projects) {
      suggestions.push('Add personal projects to demonstrate practical experience');
    }
    
    return suggestions;
  }
}

module.exports = new HuggingFaceResumeService();
`;

  // Save the service
  const servicePath = path.join(process.cwd(), 'src', 'services', 'huggingFaceResumeService.js');
  await fs.mkdir(path.dirname(servicePath), { recursive: true });
  await fs.writeFile(servicePath, serviceCode);
  
  console.log('Created Hugging Face service at:', servicePath);
  console.log('\nThis service provides several AI-powered enhancements:');
  console.log('1. Named Entity Recognition - Better extraction of names and organizations');
  console.log('2. Skill Categorization - Groups skills into technical categories');
  console.log('3. Experience Level Inference - Determines seniority from context');
  console.log('4. Related Skills Suggestion - Recommends skills often used together');
  console.log('5. Completeness Scoring - Evaluates resume quality');
  console.log('6. Improvement Suggestions - Provides actionable feedback\n');
  
  console.log('The service is designed to augment, not replace, your existing parser.');
  console.log('It adds an "huggingFaceEnhancement" object to preserve original data.\n');
  
  // Create integration instructions
  console.log('=== Integration Instructions ===\n');
  console.log('1. Add HUGGINGFACE_API_KEY to your .env file');
  console.log('   Get your free API key from: https://huggingface.co/settings/tokens\n');
  
  console.log('2. Install required dependency:');
  console.log('   npm install axios\n');
  
  console.log('3. Update your existing resume parsing service to use enhancement');
  
  return servicePath;
}

createHuggingFaceService();
