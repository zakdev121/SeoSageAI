import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Plus, Globe, Key, Target, LogIn, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AuthFormProps {
  onAuthSuccess: (data: { user: any; tenant: any }) => void;
}

export function AuthForm({ onAuthSuccess }: AuthFormProps) {
  const [activeTab, setActiveTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Login form state
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  // Signup form state
  const [signupData, setSignupData] = useState({
    email: "",
    password: "",
    name: "",
    website: "",
    industry: "",
    keywords: [] as string[],
    plan: "starter" as "starter" | "professional" | "enterprise",
    apiKeys: {
      googleApiKey: "",
      googleSearchEngineId: "",
      wpUsername: "",
      wpPassword: "",
    },
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      toast({
        title: "Welcome back!",
        description: "Successfully logged in to your SEO AI dashboard.",
      });

      onAuthSuccess(data);
    } catch (error) {
      toast({
        title: "Login failed",
        description: error instanceof Error ? error.message : "Please check your credentials.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      toast({
        title: "Account created!",
        description: "Your SEO AI is ready to analyze your website.",
      });

      onAuthSuccess(data);
    } catch (error) {
      toast({
        title: "Signup failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !signupData.keywords.includes(newKeyword.trim())) {
      setSignupData(prev => ({
        ...prev,
        keywords: [...prev.keywords, newKeyword.trim()]
      }));
      setNewKeyword("");
    }
  };

  const removeKeyword = (keyword: string) => {
    setSignupData(prev => ({
      ...prev,
      keywords: prev.keywords.filter(k => k !== keyword)
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">SEO AI Platform</CardTitle>
          <CardDescription className="text-center">
            Intelligent SEO automation for your website
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login" className="flex items-center space-x-2">
                <LogIn className="w-4 h-4" />
                <span>Login</span>
              </TabsTrigger>
              <TabsTrigger value="signup" className="flex items-center space-x-2">
                <UserPlus className="w-4 h-4" />
                <span>Get Started</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4 mt-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="Enter your email"
                    value={loginData.email}
                    onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="Enter your password"
                    value={loginData.password}
                    onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>

              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <p className="text-sm text-blue-600 font-medium">Demo Credentials</p>
                <p className="text-xs text-blue-500 mt-1">
                  Email: admin@synviz.com<br />
                  Password: seoai2024
                </p>
              </div>
            </TabsContent>

            <TabsContent value="signup" className="space-y-6 mt-6">
              <form onSubmit={handleSignup} className="space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 text-lg font-semibold text-blue-600">
                    <Globe className="w-5 h-5" />
                    <span>Account & Website</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="signup-name">Name/Company</Label>
                      <Input
                        id="signup-name"
                        placeholder="Your name or company"
                        value={signupData.name}
                        onChange={(e) => setSignupData(prev => ({ ...prev, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="your@email.com"
                        value={signupData.email}
                        onChange={(e) => setSignupData(prev => ({ ...prev, email: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="signup-password">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Minimum 6 characters"
                        value={signupData.password}
                        onChange={(e) => setSignupData(prev => ({ ...prev, password: e.target.value }))}
                        required
                        minLength={6}
                      />
                    </div>
                    <div>
                      <Label htmlFor="signup-website">Website URL</Label>
                      <Input
                        id="signup-website"
                        type="url"
                        placeholder="https://yoursite.com"
                        value={signupData.website}
                        onChange={(e) => setSignupData(prev => ({ ...prev, website: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="signup-industry">Industry</Label>
                    <Select value={signupData.industry} onValueChange={(value) => setSignupData(prev => ({ ...prev, industry: value }))}>
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

                {/* Keywords */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 text-lg font-semibold text-blue-600">
                    <Target className="w-5 h-5" />
                    <span>Target Keywords</span>
                  </div>

                  <div className="flex space-x-2">
                    <Input
                      placeholder="Enter a keyword"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                    />
                    <Button type="button" onClick={addKeyword} size="sm">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {signupData.keywords.map((keyword) => (
                      <Badge key={keyword} variant="secondary" className="flex items-center space-x-1">
                        <span>{keyword}</span>
                        <X
                          className="w-3 h-3 cursor-pointer hover:text-red-500"
                          onClick={() => removeKeyword(keyword)}
                        />
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Plan Selection */}
                <div className="space-y-4">
                  <div className="text-lg font-semibold text-blue-600">Choose Plan</div>
                  <div className="grid gap-3">
                    {plans.map((plan) => (
                      <div
                        key={plan.id}
                        className={`border rounded-lg p-3 cursor-pointer transition-all ${
                          signupData.plan === plan.id
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSignupData(prev => ({ ...prev, plan: plan.id as any }))}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">{plan.name}</h3>
                            <p className="text-lg font-bold text-blue-600">{plan.price}</p>
                            <div className="text-xs text-gray-600 mt-1">
                              {plan.features.slice(0, 2).join(" • ")}
                            </div>
                          </div>
                          <div className={`w-4 h-4 rounded-full border-2 ${
                            signupData.plan === plan.id ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                          }`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* API Keys (Optional) */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 text-lg font-semibold text-blue-600">
                    <Key className="w-5 h-5" />
                    <span>API Configuration (Optional)</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label htmlFor="google-api">Google API Key</Label>
                      <Input
                        id="google-api"
                        type="password"
                        placeholder="For competitor research"
                        value={signupData.apiKeys.googleApiKey}
                        onChange={(e) => setSignupData(prev => ({
                          ...prev,
                          apiKeys: { ...prev.apiKeys, googleApiKey: e.target.value }
                        }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="search-engine-id">Search Engine ID</Label>
                      <Input
                        id="search-engine-id"
                        placeholder="Custom search engine"
                        value={signupData.apiKeys.googleSearchEngineId}
                        onChange={(e) => setSignupData(prev => ({
                          ...prev,
                          apiKeys: { ...prev.apiKeys, googleSearchEngineId: e.target.value }
                        }))}
                      />
                    </div>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-blue-600 hover:bg-blue-700" 
                  disabled={loading || !signupData.email || !signupData.password || !signupData.name || !signupData.website || !signupData.industry}
                >
                  {loading ? "Creating Account..." : "Create SEO AI Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}