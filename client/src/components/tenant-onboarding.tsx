import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Globe, Key, Target } from "lucide-react";

interface TenantOnboardingProps {
  onComplete: (tenantConfig: TenantConfig) => void;
}

interface TenantConfig {
  name: string;
  website: string;
  industry: string;
  keywords: string[];
  plan: string;
  apiKeys: {
    googleApiKey?: string;
    googleSearchEngineId?: string;
    wpUsername?: string;
    wpPassword?: string;
  };
}

export function TenantOnboarding({ onComplete }: TenantOnboardingProps) {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<TenantConfig>({
    name: "",
    website: "",
    industry: "",
    keywords: [],
    plan: "starter",
    apiKeys: {}
  });
  const [newKeyword, setNewKeyword] = useState("");

  const industries = [
    "Technology Services",
    "E-commerce",
    "Healthcare",
    "Real Estate",
    "Professional Services",
    "Manufacturing",
    "Education",
    "Finance",
    "Marketing Agency",
    "SaaS",
    "Non-profit",
    "Other"
  ];

  const plans = [
    { id: "starter", name: "Starter", price: "$49/month", features: ["5 audits/month", "10 fixes/month", "Basic reporting"] },
    { id: "professional", name: "Professional", price: "$149/month", features: ["25 audits/month", "50 fixes/month", "Competitor analysis", "API access"] },
    { id: "enterprise", name: "Enterprise", price: "$399/month", features: ["Unlimited audits", "Unlimited fixes", "White-label", "Dedicated support"] }
  ];

  const addKeyword = () => {
    if (newKeyword.trim() && !config.keywords.includes(newKeyword.trim())) {
      setConfig(prev => ({
        ...prev,
        keywords: [...prev.keywords, newKeyword.trim()]
      }));
      setNewKeyword("");
    }
  };

  const removeKeyword = (keyword: string) => {
    setConfig(prev => ({
      ...prev,
      keywords: prev.keywords.filter(k => k !== keyword)
    }));
  };

  const updateConfig = (field: string, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const updateApiKey = (key: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      apiKeys: { ...prev.apiKeys, [key]: value }
    }));
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return config.name && config.website && config.industry;
      case 2:
        return config.keywords.length > 0;
      case 3:
        return config.plan;
      case 4:
        return true; // API keys are optional
      default:
        return false;
    }
  };

  const handleComplete = () => {
    onComplete(config);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold">Setup Your SEO AI</CardTitle>
              <CardDescription>
                Configure your website for intelligent SEO automation
              </CardDescription>
            </div>
            <div className="flex space-x-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full ${
                    i <= step ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-lg font-semibold text-blue-600">
                <Globe className="w-5 h-5" />
                <span>Website Information</span>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Company/Project Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter your company name"
                    value={config.name}
                    onChange={(e) => updateConfig('name', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="website">Website URL</Label>
                  <Input
                    id="website"
                    placeholder="https://yourwebsite.com"
                    value={config.website}
                    onChange={(e) => updateConfig('website', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="industry">Industry</Label>
                  <Select value={config.industry} onValueChange={(value) => updateConfig('industry', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {industries.map((industry) => (
                        <SelectItem key={industry} value={industry}>
                          {industry}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-lg font-semibold text-blue-600">
                <Target className="w-5 h-5" />
                <span>Target Keywords</span>
              </div>
              
              <p className="text-sm text-gray-600">
                Add the main keywords you want to rank for. These will guide the AI's optimization suggestions.
              </p>

              <div className="flex space-x-2">
                <Input
                  placeholder="Enter a keyword"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                />
                <Button onClick={addKeyword} size="sm">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {config.keywords.map((keyword) => (
                  <Badge key={keyword} variant="secondary" className="flex items-center space-x-1">
                    <span>{keyword}</span>
                    <X
                      className="w-3 h-3 cursor-pointer hover:text-red-500"
                      onClick={() => removeKeyword(keyword)}
                    />
                  </Badge>
                ))}
              </div>

              {config.keywords.length === 0 && (
                <p className="text-sm text-amber-600">Add at least one keyword to continue</p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="text-lg font-semibold text-blue-600">Choose Your Plan</div>
              
              <div className="grid gap-4">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      config.plan === plan.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => updateConfig('plan', plan.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">{plan.name}</h3>
                        <p className="text-2xl font-bold text-blue-600">{plan.price}</p>
                        <ul className="text-sm text-gray-600 mt-2 space-y-1">
                          {plan.features.map((feature) => (
                            <li key={feature}>• {feature}</li>
                          ))}
                        </ul>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        config.plan === plan.id ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                      }`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-lg font-semibold text-blue-600">
                <Key className="w-5 h-5" />
                <span>API Configuration</span>
              </div>
              
              <p className="text-sm text-gray-600">
                Configure API access for enhanced features. All fields are optional but recommended for full functionality.
              </p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="googleApiKey">Google API Key</Label>
                    <Input
                      id="googleApiKey"
                      type="password"
                      placeholder="For competitor research"
                      value={config.apiKeys.googleApiKey || ''}
                      onChange={(e) => updateApiKey('googleApiKey', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="googleSearchEngineId">Search Engine ID</Label>
                    <Input
                      id="googleSearchEngineId"
                      placeholder="Custom search engine ID"
                      value={config.apiKeys.googleSearchEngineId || ''}
                      onChange={(e) => updateApiKey('googleSearchEngineId', e.target.value)}
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">WordPress Integration (if applicable)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="wpUsername">WP Username</Label>
                      <Input
                        id="wpUsername"
                        placeholder="WordPress username"
                        value={config.apiKeys.wpUsername || ''}
                        onChange={(e) => updateApiKey('wpUsername', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="wpPassword">WP App Password</Label>
                      <Input
                        id="wpPassword"
                        type="password"
                        placeholder="Application password"
                        value={config.apiKeys.wpPassword || ''}
                        onChange={(e) => updateApiKey('wpPassword', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-800">Setup Complete!</h4>
                <p className="text-sm text-blue-600 mt-1">
                  Your SEO AI will analyze your website using the configured keywords and industry focus. 
                  You can update these settings anytime from your dashboard.
                </p>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setStep(step - 1)}
            disabled={step === 1}
          >
            Previous
          </Button>
          
          {step < 4 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Launch SEO AI
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}