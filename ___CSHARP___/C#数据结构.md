``` csharp
if(!preSumDic.ContainsKey(sum))
{
    preSumDic.Add(sum, 1);
}
else
{
    preSumDic[sum]++;
}
```

这里必须要分类