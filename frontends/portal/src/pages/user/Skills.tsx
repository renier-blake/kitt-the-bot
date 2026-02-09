import { Wrench, Plus, Download, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const mySkills = [
  { id: 1, name: 'Daily Reflection', description: 'Reflect on your day', active: true },
  { id: 2, name: 'Nutrition Logger', description: 'Track meals and calories', active: true },
  { id: 3, name: 'Workout Tracker', description: 'Log your workouts', active: false },
]

export function Skills() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Skills</h1>
          <p className="text-muted-foreground">
            Manage your installed skills
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Install Skill
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mySkills.map((skill) => (
          <Card key={skill.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{skill.name}</CardTitle>
                  <CardDescription>{skill.description}</CardDescription>
                </div>
                <Badge variant={skill.active ? 'default' : 'secondary'}>
                  {skill.active ? 'Active' : 'Paused'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1">
                <Download className="mr-2 h-4 w-4" />
                Update
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Remove
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-muted/50">
        <CardContent className="p-6 text-center">
          <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Skill Marketplace</h3>
          <p className="text-muted-foreground mb-4">
            Discover and install new skills to extend KITT's capabilities
          </p>
          <Button>Browse Marketplace</Button>
        </CardContent>
      </Card>
    </div>
  )
}
