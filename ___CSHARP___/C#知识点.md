1.

``` csharp
/// <summary>
/// 计算两个数的除法
/// </summary>
/// <param name="a">被除数</param>
/// <param name="b">除数</param>
/// <returns>除法结果</returns>
/// <exception cref="DivideByZeroException">当除数b为0时抛出</exception>
/// <exception cref="ArgumentException">当参数不满足某些条件时抛出</exception>
public double Divide(double a, double b)
{
    if (b == 0)
    {
        throw new DivideByZeroException("除数不能为零");
    }
    return a / b;
}
```

2.到底是属性还是字段+属性取决于get/set是否有特殊操作，如：

``` csharp
private int _currentHP;
public int CurrentHP {
    get => _currentHP;
    set {
        _currentHP = value;
        OnHPChanged?.Invoke(value); // 通知 ViewModel
    }
}
public event Action<int> OnHPChanged;
```

由于set并非直接设置，所以必须要字段
为了统一，除非没有特殊情况，都应该使用字段+属性